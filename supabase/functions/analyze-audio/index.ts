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

    // Get project
    const { data: project, error: pErr } = await supabase
      .from("projects")
      .select("*")
      .eq("id", project_id)
      .single();
    if (pErr || !project) throw new Error("Project not found");

    // Update status
    await supabase.from("projects").update({ status: "analyzing" }).eq("id", project_id);

    // For audio clips, we simulate audio analysis using AI
    // In production, this would use a real audio analysis library
    const durationSec = project.duration_sec || 180;
    const bpm = 120; // Default BPM - would be extracted from audio
    const beatInterval = 60 / bpm;
    
    // Generate beat timestamps
    const beats: number[] = [];
    for (let t = 0; t < durationSec; t += beatInterval) {
      beats.push(Math.round(t * 1000) / 1000);
    }

    // Generate sections based on typical song structure
    const sections = [];
    if (durationSec <= 60) {
      sections.push({ type: "intro", start: 0, end: 10 });
      sections.push({ type: "verse", start: 10, end: 40 });
      sections.push({ type: "outro", start: 40, end: durationSec });
    } else {
      const sectionDur = durationSec / 6;
      sections.push({ type: "intro", start: 0, end: sectionDur });
      sections.push({ type: "verse1", start: sectionDur, end: sectionDur * 2 });
      sections.push({ type: "chorus1", start: sectionDur * 2, end: sectionDur * 3 });
      sections.push({ type: "verse2", start: sectionDur * 3, end: sectionDur * 4 });
      sections.push({ type: "chorus2", start: sectionDur * 4, end: sectionDur * 5 });
      sections.push({ type: "outro", start: sectionDur * 5, end: durationSec });
    }

    // Generate energy curve (0-1 values per section)
    const energy = sections.map((s) => ({
      section: s.type,
      start: s.start,
      end: s.end,
      energy: s.type.includes("chorus") ? 0.9 : s.type === "intro" || s.type === "outro" ? 0.4 : 0.65,
    }));

    // Store analysis
    const { error: insertErr } = await supabase.from("audio_analysis").upsert({
      project_id,
      bpm,
      beats_json: beats,
      sections_json: sections,
      energy_json: energy,
    }, { onConflict: "project_id" });

    if (insertErr) throw insertErr;

    // Update project duration if not set
    if (!project.duration_sec) {
      await supabase.from("projects").update({ duration_sec: durationSec }).eq("id", project_id);
    }

    // Move to planning
    await supabase.from("projects").update({ status: "planning" }).eq("id", project_id);

    return new Response(JSON.stringify({ success: true, bpm, sections: sections.length, beats: beats.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
