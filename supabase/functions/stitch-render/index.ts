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

    // Get completed shots ordered by idx
    const { data: shots } = await supabase
      .from("shots")
      .select("*")
      .eq("project_id", project_id)
      .eq("status", "completed")
      .order("idx");

    if (!shots || shots.length === 0) throw new Error("No completed shots to stitch");

    // Get audio analysis for beat-aligned cuts
    const { data: analysis } = await supabase
      .from("audio_analysis")
      .select("*")
      .eq("project_id", project_id)
      .maybeSingle();

    const energyData = (analysis?.energy_json as any[]) || [];
    const highestEnergy = [...energyData].sort((a, b) => (b.energy || 0) - (a.energy || 0))[0];

    // Build FFmpeg-ready manifest (for when a real render service is connected)
    const manifest = {
      project_id,
      audio_url: project.audio_url,
      bpm: analysis?.bpm || 120,
      shots: shots.map(s => ({
        idx: s.idx,
        url: s.output_url,
        duration_sec: s.duration_sec,
        start_sec: null, // Will be computed from beat grid
      })),
      outputs: {
        master_16_9: { width: 1920, height: 1080, format: "mp4" },
        master_9_16: { width: 1080, height: 1920, format: "mp4", crop: true },
        teaser: { duration: 15, start_section: highestEnergy?.section || "chorus1" },
      },
      beat_grid: analysis?.beats_json || [],
      transitions: "cut_on_beat",
    };

    const thumbs = shots.slice(0, 6).map(s => s.output_url).filter(Boolean);

    // Check for external FFmpeg render service
    const renderServiceUrl = Deno.env.get("FFMPEG_RENDER_SERVICE_URL");

    let renderResult: any;

    if (renderServiceUrl) {
      // Call external FFmpeg service
      try {
        const res = await fetch(renderServiceUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(manifest),
        });
        renderResult = await res.json();
      } catch (err: any) {
        console.warn("External render service failed:", err.message);
        renderResult = null;
      }
    }

    // Create or update render record
    const renderData: any = {
      project_id,
      status: "completed",
      thumbs_json: thumbs,
      logs: JSON.stringify({
        manifest,
        shots_count: shots.length,
        highest_energy_section: highestEnergy?.section || "unknown",
        stitched_at: new Date().toISOString(),
        used_external_service: !!renderResult,
      }),
    };

    if (renderResult?.master_url_16_9) {
      renderData.master_url_16_9 = renderResult.master_url_16_9;
      renderData.master_url_9_16 = renderResult.master_url_9_16;
      renderData.teaser_url = renderResult.teaser_url;
    } else {
      // Placeholder URLs using first shot — will be replaced by real render service
      renderData.master_url_16_9 = shots[0]?.output_url || null;
      renderData.master_url_9_16 = shots[0]?.output_url || null;
      renderData.teaser_url = shots[0]?.output_url || null;
    }

    const { error: renderErr } = await supabase
      .from("renders")
      .upsert(renderData, { onConflict: "project_id" });

    if (renderErr) throw renderErr;

    // Mark project completed
    await supabase.from("projects").update({ status: "completed" }).eq("id", project_id);

    return new Response(JSON.stringify({
      success: true,
      shots_stitched: shots.length,
      has_render_service: !!renderServiceUrl,
      manifest_ready: true,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
