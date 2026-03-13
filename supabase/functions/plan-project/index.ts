import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Cinematic Formula: 5 Pillars ──────────────────────────────────────────
// [Sujet Détaillé] + [Style Artistique] + [Cadrage & Composition] + [Lumière & Ambiance] + [Détails & Textures]

const CAMERA_MOVEMENTS: Record<string, string[]> = {
  wide: ["slow dolly out", "crane shot ascending", "establishing pan left to right", "static wide angle"],
  medium: ["smooth tracking shot", "steady dolly forward", "slow orbit around subject", "handheld follow"],
  close: ["static close-up", "slow push in", "rack focus to subject", "intimate handheld"],
  detail: ["macro lens extreme close-up", "slow tilt reveal", "focus pull between details", "static insert shot"],
};

const ENERGY_CAMERA_MAP: Record<string, string> = {
  high: "dynamic fast-paced cuts, whip pans, rapid dolly movements, handheld energy",
  medium: "smooth tracking shots, moderate pacing, balanced compositions",
  low: "slow contemplative movements, static wide shots, long takes, gentle drifts",
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

    const prompt = `You are an elite film director AI applying the **5 Pillars Cinematic Formula** to create a production plan.

## 5 PILLARS FORMULA
Every shot prompt MUST follow this structure:
1. **[SUBJECT & ACTION]** — Detailed description of who/what and what's happening
2. **[ARTISTIC STYLE]** — Visual style, artistic movement, texture quality
3. **[FRAMING & COMPOSITION]** — Camera angle (low angle, bird's eye, dutch angle), shot type (wide/medium/close/detail), rule of thirds, leading lines
4. **[LIGHTING & ATMOSPHERE]** — Light source, quality (hard/soft), color temperature, shadows, time of day
5. **[DETAILS & TEXTURES]** — Micro-details, materials, particles, environmental elements

## PROJECT DETAILS
- Title: ${project.title}
- Type: ${project.type === "clip" ? "Music video clip" : "Short film"}
- Mode: ${project.mode || "story"} (story = narrative arc, performance = live performance, abstract = visual art)
- Style preset: ${project.style_preset || "cinematic"}
- Duration: ${durationSec} seconds
- Synopsis: ${project.synopsis || "No synopsis provided"}
- Audio BPM: ${analysis?.bpm || 120}
- Audio sections: ${JSON.stringify(sections)}
- Energy curve: ${JSON.stringify(energyData)}
- Number of shots needed: ${numShots}

## CHARACTER BIBLE RULES
For each character, define the 3 narrative pillars:
- **Want** (conscious desire): What the character believes they want
- **Need** (unconscious need): What they truly need for growth
- **Flaw** (fatal flaw): What prevents them from getting what they want
- **Visual description**: Extremely detailed physical description for consistent AI generation across all shots

## CAMERA MOVEMENT GUIDELINES
- Opening shots (first 15%): Establishing shots — slow dolly, crane, or static wide
- High energy sections (chorus): Dynamic tracking, whip pans, fast cuts, handheld
- Low energy sections (verse/intro): Slow movements, contemplative wide shots, long takes
- Emotional moments: Close-ups with slow push-in or static intimate framing
- Climax (last 15%): Most dynamic camera work, climactic angles

## STYLE BIBLE REQUIREMENTS
Include:
- visual_rules: Comprehensive description of the visual language
- palette: Array of 5 specific colors (hex or descriptive)
- camera_rules: Default camera behavior and movement patterns
- lighting: Detailed lighting setup (key, fill, rim, practicals)
- mood: Emotional tone and atmosphere
- texture_guidelines: Film grain, lens effects, post-processing look

Generate a JSON response with this exact structure:
{
  "style_bible": {
    "visual_rules": "comprehensive visual style description applying the 5 pillars",
    "palette": ["color1", "color2", "color3", "color4", "color5"],
    "camera_rules": "detailed camera movement and framing guidelines",
    "lighting": "detailed lighting style with key/fill/rim descriptions",
    "mood": "emotional tone and atmosphere",
    "texture_guidelines": "film grain, lens effects, post-processing"
  },
  "character_bible": [
    {
      "name": "Character name",
      "description": "Extremely detailed visual description for consistent AI generation",
      "role": "protagonist/antagonist/supporting",
      "want": "conscious desire",
      "need": "unconscious need",
      "flaw": "fatal flaw"
    }
  ],
  "shotlist": [
    {
      "idx": 0,
      "start_sec": 0,
      "end_sec": 7,
      "duration_sec": 7,
      "shot_type": "wide/medium/close/detail",
      "camera_movement": "specific camera movement for this shot",
      "prompt": "[SUBJECT & ACTION] detailed action. [STYLE] ${project.style_preset} aesthetic. [FRAMING] specific angle and composition. [LIGHTING] specific lighting setup. [DETAILS] textures, particles, environmental details.",
      "negative_prompt": "blurry, low quality, distorted, watermark, text overlay, inconsistent style, generic, stock footage look",
      "section": "intro/verse/chorus/bridge/outro",
      "energy_level": "low/medium/high"
    }
  ]
}

CRITICAL RULES:
- Make exactly ${numShots} shots covering the full ${durationSec} seconds
- Each shot 5-10 seconds
- EVERY prompt must explicitly include all 5 pillars
- Match energy: high-energy sections get dynamic/fast shots, low-energy get slower/wider
- Character descriptions must be reused verbatim across shots for consistency
- Negative prompts must be specific and relevant
- Respond ONLY with valid JSON`;

    let plan: any;
    try {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
          if (!plan.shotlist?.length || plan.shotlist.length < 3) {
            console.warn("AI plan had too few shots, falling back");
            plan = null;
          }
        }
      } else {
        const errText = await aiResponse.text();
        console.warn("AI gateway error:", aiResponse.status, errText);
      }
    } catch (aiErr: any) {
      console.warn("AI call failed, using fallback plan:", aiErr.message);
    }

    // Fallback plan with 5 pillars applied
    if (!plan) {
      const shotDuration = durationSec / numShots;
      const shotTypes = ["wide", "medium", "close", "detail"];
      const sectionsList = sections as any[];

      plan = {
        style_bible: {
          visual_rules: `${project.style_preset} style with consistent visual language. Apply the 5 pillars: detailed subjects, strong artistic direction, intentional framing, motivated lighting, rich textures.`,
          palette: ["deep midnight blue", "warm amber gold", "soft ivory white", "muted charcoal", "accent crimson"],
          camera_rules: "Smooth dolly movements for wide shots, intimate handheld for close-ups, dynamic tracking for action sequences. Always motivated camera movement.",
          lighting: "Cinematic three-point lighting: warm key light at 45°, cool fill from opposite side, rim light for depth separation. Practical lights for atmosphere.",
          mood: project.mode === "abstract" ? "ethereal, surreal, hypnotic" : "compelling, emotional, immersive",
          texture_guidelines: "Subtle film grain, slight lens vignette, organic color grading with lifted blacks. Avoid digital sharpness.",
        },
        character_bible: project.mode === "abstract" ? [] : [
          {
            name: "Main Character",
            description: `A compelling figure in ${project.style_preset} visual style. Medium build, expressive eyes, distinctive silhouette. Consistent wardrobe: dark layered clothing with one accent color piece. Visible in all narrative shots.`,
            role: "protagonist",
            want: "To find connection in a disconnected world",
            need: "To accept vulnerability as strength",
            flaw: "Emotional walls built from past wounds",
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
          const shotType = shotTypes[i % 4];
          const cameraOptions = CAMERA_MOVEMENTS[shotType];
          const cameraMove = cameraOptions[i % cameraOptions.length];
          const energyLevel = isHighEnergy ? "high" : (section.includes("bridge") ? "medium" : "low");

          return {
            idx: i,
            start_sec: startSec,
            end_sec: endSec,
            duration_sec: Math.round(shotDuration * 10) / 10,
            shot_type: shotType,
            camera_movement: cameraMove,
            prompt: `[SUBJECT] ${isHighEnergy ? "Dynamic action sequence" : "Contemplative moment"}, shot ${i + 1} of ${numShots}. [STYLE] ${project.style_preset} aesthetic, cohesive visual language. [FRAMING] ${shotType} shot, ${cameraMove}. [LIGHTING] ${isHighEnergy ? "High contrast dramatic lighting with sharp shadows" : "Soft diffused lighting with gentle gradients"}. [DETAILS] Rich textures, atmospheric particles, ${section} section energy.`,
            negative_prompt: "blurry, low quality, distorted, watermark, text overlay, inconsistent style, generic stock footage, AI artifacts",
            section,
            energy_level: energyLevel,
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
