import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { project_id } = await req.json();
    if (!project_id) throw new Error("project_id required");

    const { data: project } = await supabase.from("projects").select("*").eq("id", project_id).single();
    if (!project) throw new Error("Project not found");

    const { data: analysis } = await supabase.from("audio_analysis").select("*").eq("project_id", project_id).maybeSingle();

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const sections = analysis?.sections_json || [];
    const energyData = analysis?.energy_json || [];
    const durationSec = project.duration_sec || 180;
    const numShots = Math.max(10, Math.ceil(durationSec / 7));

    const prompt = `You are a film director AI. Create a detailed production plan for a ${project.type === "clip" ? "music video clip" : "short film"}.

Project details:
- Title: ${project.title}
- Mode: ${project.mode || "story"} (story = narrative arc, performance = live performance, abstract = visual art)
- Style: ${project.style_preset || "cinematic"}
- Duration: ${durationSec} seconds
- Synopsis: ${project.synopsis || "No synopsis provided"}
- Audio BPM: ${analysis?.bpm || 120}
- Audio sections: ${JSON.stringify(sections)}
- Energy curve: ${JSON.stringify(energyData)}
- Number of shots needed: ${numShots}

Generate a JSON response with this exact structure:
{
  "style_bible": {
    "visual_rules": "description of overall visual style",
    "palette": ["color1", "color2", "color3"],
    "camera_rules": "camera movement and framing guidelines",
    "lighting": "lighting style description",
    "mood": "overall mood"
  },
  "character_bible": [
    {
      "name": "Character name",
      "description": "Detailed visual description for consistent generation",
      "role": "protagonist/supporting"
    }
  ],
  "shotlist": [
    {
      "idx": 0,
      "start_sec": 0,
      "end_sec": 7,
      "duration_sec": 7,
      "shot_type": "wide/medium/close/detail",
      "prompt": "Highly detailed image generation prompt for this shot including visual style, camera angle, lighting, action",
      "negative_prompt": "Things to avoid",
      "section": "intro"
    }
  ]
}

IMPORTANT: Make exactly ${numShots} shots covering the full ${durationSec} seconds. Each shot 5-10s. Match energy: high-energy sections (chorus) get dynamic/fast shots, low-energy (intro/outro) get slower/wider shots. Prompts must be very detailed for video generation AI. Respond ONLY with valid JSON.`;

    let plan: any;
    try {
      const aiResponse = await fetch("https://ai.lovable.dev/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 8000,
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          plan = JSON.parse(jsonMatch[0]);
          // Validate shotlist
          if (!plan.shotlist?.length || plan.shotlist.length < 3) {
            console.warn("AI plan had too few shots, falling back");
            plan = null;
          }
        }
      }
    } catch (aiErr: any) {
      console.warn("AI call failed, using fallback plan:", aiErr.message);
    }

    // Fallback plan
    if (!plan) {
      const shotDuration = durationSec / numShots;
      const shotTypes = ["wide", "medium", "close", "detail"];
      const sectionsList = sections as any[];

      plan = {
        style_bible: {
          visual_rules: `${project.style_preset} style, cinematic quality, consistent visual language`,
          palette: ["deep blue", "warm amber", "soft white"],
          camera_rules: "Smooth dolly movements, varied angles matching music energy",
          lighting: "Dramatic cinematic lighting with motivated sources",
          mood: project.mode === "abstract" ? "ethereal and surreal" : "compelling and emotional",
        },
        character_bible: project.mode === "abstract" ? [] : [
          {
            name: "Main Character",
            description: `A compelling figure in ${project.style_preset} visual style, consistent appearance throughout`,
            role: "protagonist",
          },
        ],
        shotlist: Array.from({ length: numShots }, (_, i) => {
          const startSec = Math.round(i * shotDuration * 10) / 10;
          const endSec = Math.round((i + 1) * shotDuration * 10) / 10;
          const sectionIdx = Math.min(
            Math.floor(i / Math.max(1, numShots / Math.max(1, sectionsList.length))),
            sectionsList.length - 1
          );
          const section = sectionsList[sectionIdx]?.type || "verse";
          const isHighEnergy = section.includes("chorus");

          return {
            idx: i,
            start_sec: startSec,
            end_sec: endSec,
            duration_sec: Math.round(shotDuration * 10) / 10,
            shot_type: shotTypes[i % 4],
            prompt: `${project.style_preset} style, ${isHighEnergy ? "dynamic fast-paced" : "smooth contemplative"} ${shotTypes[i % 4]} shot, cinematic quality, dramatic lighting, ${section} section, shot ${i + 1} of ${numShots}`,
            negative_prompt: "blurry, low quality, distorted, watermark, text overlay",
            section,
          };
        }),
      };
    }

    // Store plan
    await supabase.from("plans").insert({
      project_id,
      style_bible_json: plan.style_bible,
      character_bible_json: plan.character_bible,
      shotlist_json: plan.shotlist,
      version: 1,
    });

    // Create shot records
    const shotsToInsert = plan.shotlist.map((s: any) => ({
      project_id,
      idx: s.idx,
      prompt: s.prompt,
      negative_prompt: s.negative_prompt || null,
      duration_sec: s.duration_sec,
      status: "pending",
    }));

    await supabase.from("shots").insert(shotsToInsert);

    // Advance to generating
    await supabase.from("projects").update({ status: "generating" }).eq("id", project_id);

    return new Response(JSON.stringify({
      success: true,
      shots_created: plan.shotlist.length,
      has_ai_plan: !!plan.style_bible?.visual_rules,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Plan error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
