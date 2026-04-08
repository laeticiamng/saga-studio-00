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

    const { data: project, error: pErr } = await supabase
      .from("projects")
      .select("*")
      .eq("id", project_id)
      .single();
    if (pErr || !project) throw new Error("Project not found");

    // Update status to analyzing
    await supabase.from("projects").update({ status: "analyzing" }).eq("id", project_id);

    const durationSec = project.duration_sec || 180;

    // Try AI-based audio analysis if audio URL exists
    let bpm = 120;
    let sections: any[] = [];
    let energy: any[] = [];
    let beats: number[] = [];

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (apiKey && project.audio_url) {
      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{
              role: "user",
              content: `Analyze this music track for video production. The track is titled "${project.title}", style: ${project.style_preset || "cinematic"}, mode: ${project.mode || "story"}, approx duration: ${durationSec}s.

Estimate realistic BPM and song structure. Return ONLY valid JSON:
{
  "bpm": 128,
  "sections": [
    {"type": "intro", "start": 0, "end": 20, "energy": 0.3},
    {"type": "verse1", "start": 20, "end": 50, "energy": 0.5},
    {"type": "chorus1", "start": 50, "end": 80, "energy": 0.9}
  ]
}`
            }],
            max_tokens: 2000,
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.bpm) bpm = parsed.bpm;
            if (parsed.sections?.length) {
              sections = parsed.sections.map((s: any) => ({
                type: s.type, start: s.start, end: s.end,
              }));
              energy = parsed.sections.map((s: any) => ({
                section: s.type, start: s.start, end: s.end, energy: s.energy || 0.5,
              }));
            }
          }
        }
      } catch (aiErr: unknown) {
        console.warn("AI analysis failed, using heuristic:", aiErr instanceof Error ? aiErr.message : aiErr);
      }
    }

    // Fallback: heuristic analysis
    if (sections.length === 0) {
      if (durationSec <= 60) {
        sections = [
          { type: "intro", start: 0, end: Math.round(durationSec * 0.15) },
          { type: "verse", start: Math.round(durationSec * 0.15), end: Math.round(durationSec * 0.7) },
          { type: "outro", start: Math.round(durationSec * 0.7), end: durationSec },
        ];
      } else {
        const d = durationSec / 6;
        sections = [
          { type: "intro", start: 0, end: Math.round(d) },
          { type: "verse1", start: Math.round(d), end: Math.round(d * 2) },
          { type: "chorus1", start: Math.round(d * 2), end: Math.round(d * 3) },
          { type: "verse2", start: Math.round(d * 3), end: Math.round(d * 4) },
          { type: "chorus2", start: Math.round(d * 4), end: Math.round(d * 5) },
          { type: "outro", start: Math.round(d * 5), end: durationSec },
        ];
      }

      energy = sections.map(s => ({
        section: s.type,
        start: s.start,
        end: s.end,
        energy: s.type.includes("chorus") ? 0.9 : s.type === "intro" || s.type === "outro" ? 0.4 : 0.65,
      }));
    }

    // Generate beat grid
    const beatInterval = 60 / bpm;
    for (let t = 0; t < durationSec; t += beatInterval) {
      beats.push(Math.round(t * 1000) / 1000);
    }

    // Store analysis (upsert to handle re-runs)
    const { error: insertErr } = await supabase.from("audio_analysis").upsert({
      project_id,
      bpm,
      beats_json: beats,
      sections_json: sections,
      energy_json: energy,
    }, { onConflict: "project_id" });

    if (insertErr) throw insertErr;

    // Update duration if not set
    if (!project.duration_sec) {
      await supabase.from("projects").update({ duration_sec: durationSec }).eq("id", project_id);
    }

    // Advance to planning
    await supabase.from("projects").update({ status: "planning" }).eq("id", project_id);

    return new Response(JSON.stringify({
      success: true,
      bpm,
      sections: sections.length,
      beats: beats.length,
      duration_sec: durationSec,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
