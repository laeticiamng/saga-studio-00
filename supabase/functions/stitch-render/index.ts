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

    const { data: shots } = await supabase
      .from("shots")
      .select("*")
      .eq("project_id", project_id)
      .eq("status", "completed")
      .order("idx");

    if (!shots || shots.length === 0) throw new Error("No completed shots to stitch");

    // In production, this would call an FFmpeg service to:
    // 1. Download all shot videos
    // 2. Concatenate them with transitions
    // 3. Overlay audio track
    // 4. Export 16:9, 9:16, and 15s teaser
    // For now, we create a render record with the shot URLs as reference

    const { data: analysis } = await supabase
      .from("audio_analysis")
      .select("*")
      .eq("project_id", project_id)
      .single();

    // Find highest energy section for teaser
    const energyData = (analysis?.energy_json as any[]) || [];
    const highestEnergy = energyData.sort((a, b) => (b.energy || 0) - (a.energy || 0))[0];

    const thumbs = shots.slice(0, 4).map(s => s.output_url).filter(Boolean);

    // Create or update render
    const { error: renderErr } = await supabase.from("renders").upsert({
      project_id,
      status: "completed",
      master_url_16_9: shots[0]?.output_url || null, // Placeholder - would be stitched video
      master_url_9_16: shots[0]?.output_url || null,
      teaser_url: shots[0]?.output_url || null,
      thumbs_json: thumbs,
      logs: JSON.stringify({
        shots_count: shots.length,
        highest_energy_section: highestEnergy?.section || "unknown",
        stitched_at: new Date().toISOString(),
        note: "FFmpeg stitching placeholder - connect to render service for real video stitching",
      }),
    }, { onConflict: "project_id" });

    if (renderErr) throw renderErr;

    // Update project status
    await supabase.from("projects").update({ status: "completed" }).eq("id", project_id);

    return new Response(JSON.stringify({ success: true, shots_stitched: shots.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
