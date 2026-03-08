import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { project_id } = await req.json();
    if (!project_id) throw new Error("project_id required");

    const { data: project } = await supabase.from("projects").select("*").eq("id", project_id).single();
    if (!project) throw new Error("Project not found");

    const { data: analysis } = await supabase.from("audio_analysis").select("*").eq("project_id", project_id).single();

    // Use Lovable AI (Gemini) to generate the director plan
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const sections = analysis?.sections_json || [];
    const durationSec = project.duration_sec || 180;
    const numShots = Math.max(10, Math.ceil(durationSec / 7));

    const prompt = `You are a film director AI. Create a detailed production plan for a ${project.type === "clip" ? "music video clip" : "short film"}.

Project details:
- Title: ${project.title}
- Mode: ${project.mode} (story = narrative arc, performance = live performance style, abstract = visual art)
- Style: ${project.style_preset}
- Duration: ${durationSec} seconds
- Synopsis: ${project.synopsis || "No synopsis provided"}
- Audio sections: ${JSON.stringify(sections)}
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
      "prompt": "Detailed image generation prompt for this shot",
      "negative_prompt": "Things to avoid",
      "section": "intro"
    }
  ]
}

Make ${numShots} shots that cover the full ${durationSec} seconds. Each shot should be 5-10 seconds. The prompts should be highly detailed for video generation AI. Respond ONLY with valid JSON, no markdown.`;

    let plan;
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
        }
      }
    } catch (aiErr) {
      console.warn("AI call failed, using fallback plan:", aiErr.message);
    }

    // Fallback: generate a simple plan if AI fails
    if (!plan) {
      const shotDuration = durationSec / numShots;
      plan = {
        style_bible: {
          visual_rules: `${project.style_preset} style, cinematic quality`,
          palette: ["deep blue", "warm amber", "soft white"],
          camera_rules: "Smooth movements, varied angles",
          lighting: "Dramatic cinematic lighting",
          mood: project.mode === "abstract" ? "ethereal and surreal" : "compelling and emotional",
        },
        character_bible: project.mode === "abstract" ? [] : [
          {
            name: "Main Character",
            description: `A compelling figure in ${project.style_preset} visual style`,
            role: "protagonist",
          },
        ],
        shotlist: Array.from({ length: numShots }, (_, i) => ({
          idx: i,
          start_sec: Math.round(i * shotDuration * 10) / 10,
          end_sec: Math.round((i + 1) * shotDuration * 10) / 10,
          duration_sec: Math.round(shotDuration * 10) / 10,
          shot_type: ["wide", "medium", "close", "detail"][i % 4],
          prompt: `${project.style_preset} style, shot ${i + 1} of ${numShots}, ${project.mode} mode, cinematic quality, dramatic lighting`,
          negative_prompt: "blurry, low quality, distorted, watermark",
          section: (sections as any[])[Math.min(Math.floor(i / (numShots / Math.max(1, (sections as any[]).length))), (sections as any[]).length - 1)]?.type || "verse",
        })),
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

    // Update project status to generating
    await supabase.from("projects").update({ status: "generating" }).eq("id", project_id);

    return new Response(JSON.stringify({ 
      success: true, 
      shots_created: plan.shotlist.length,
      has_ai_plan: !!aiResponse?.ok
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Plan error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
