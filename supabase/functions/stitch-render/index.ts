import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Beat-Sync Engine ───────────────────────────────────────────────────────

interface BeatPoint { time: number; strength?: number }
interface Section { label: string; start: number; end: number; type?: string }

function computeBeatAlignedCuts(
  shots: any[],
  beats: BeatPoint[],
  sections: Section[],
  totalDuration: number,
  bpm: number
): { idx: number; start_sec: number; end_sec: number; transition: string }[] {
  if (!beats.length || !shots.length) {
    const perShot = totalDuration / shots.length;
    return shots.map((s, i) => ({
      idx: s.idx,
      start_sec: i * perShot,
      end_sec: (i + 1) * perShot,
      transition: "cut",
    }));
  }

  const beatInterval = 60 / bpm;
  const beatsPerBar = 4;
  const barDuration = beatInterval * beatsPerBar;

  const barStarts: number[] = [];
  for (let t = 0; t < totalDuration; t += barDuration) {
    barStarts.push(t);
  }

  const barsPerShot = Math.max(1, Math.floor(barStarts.length / shots.length));
  const cuts: { idx: number; start_sec: number; end_sec: number; transition: string }[] = [];

  for (let i = 0; i < shots.length; i++) {
    const barIdx = i * barsPerShot;
    const startBar = barStarts[Math.min(barIdx, barStarts.length - 1)];
    const endBarIdx = Math.min(barIdx + barsPerShot, barStarts.length);
    const endBar = endBarIdx < barStarts.length ? barStarts[endBarIdx] : totalDuration;

    let transition = "cut_on_beat";
    if (sections.length > 0) {
      const sectionAtCut = sections.find(s => Math.abs(s.start - startBar) < barDuration);
      if (sectionAtCut) {
        transition = sectionAtCut.type === "chorus" ? "flash_cut" : "crossfade";
      }
    }

    const nearestBeat = beats.reduce((best, b) =>
      Math.abs(b.time - startBar) < Math.abs(best.time - startBar) ? b : best,
      beats[0]
    );
    const snappedStart = i === 0 ? 0 : nearestBeat.time;

    cuts.push({
      idx: shots[i].idx,
      start_sec: snappedStart,
      end_sec: i === shots.length - 1 ? totalDuration : endBar,
      transition,
    });
  }

  for (let i = 1; i < cuts.length; i++) {
    cuts[i].start_sec = cuts[i - 1].end_sec;
  }

  return cuts;
}

// ─── Multi-Format Export ────────────────────────────────────────────────────

interface ExportFormat {
  key: string;
  width: number;
  height: number;
  label: string;
  crop?: boolean;
}

const EXPORT_FORMATS: ExportFormat[] = [
  { key: "master_16_9", width: 1920, height: 1080, label: "16:9 Landscape" },
  { key: "master_9_16", width: 1080, height: 1920, label: "9:16 Vertical", crop: true },
  { key: "teaser", width: 1920, height: 1080, label: "15s Teaser" },
  { key: "square", width: 1080, height: 1080, label: "1:1 Square", crop: true },
];

// ─── Main Handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { project_id, formats } = await req.json();
    if (!project_id) throw new Error("project_id required");

    const { data: project } = await supabase.from("projects").select("*").eq("id", project_id).single();
    if (!project) throw new Error("Project not found");

    const { data: shots } = await supabase
      .from("shots")
      .select("*")
      .eq("project_id", project_id)
      .eq("status", "completed")
      .order("idx");

    if (!shots || shots.length === 0) {
      await supabase.from("renders").upsert({
        project_id,
        status: "failed",
        logs: JSON.stringify({ error: "No completed shots to stitch", failed_at: new Date().toISOString() }),
      }, { onConflict: "project_id" });
      await supabase.from("projects").update({ status: "failed" }).eq("id", project_id);
      throw new Error("No completed shots to stitch");
    }

    const { data: analysis } = await supabase
      .from("audio_analysis")
      .select("*")
      .eq("project_id", project_id)
      .maybeSingle();

    const bpm = analysis?.bpm || 120;
    const beatsJson = (analysis?.beats_json as any[]) || [];
    const sectionsJson = (analysis?.sections_json as any[]) || [];
    const energyData = (analysis?.energy_json as any[]) || [];
    const totalDuration = project.duration_sec || 180;

    const beats: BeatPoint[] = beatsJson.map((b: any) =>
      typeof b === "number" ? { time: b } : { time: b.time || 0, strength: b.strength }
    );

    const sections: Section[] = sectionsJson.map((s: any) => ({
      label: s.label || s.type || "unknown",
      start: s.start || 0,
      end: s.end || s.start + 30,
      type: s.type,
    }));

    const beatAlignedCuts = computeBeatAlignedCuts(shots, beats, sections, totalDuration, bpm);

    const highestEnergy = [...energyData].sort((a, b) => (b.energy || 0) - (a.energy || 0))[0];
    const teaserSection = highestEnergy?.section || "chorus1";
    const teaserStart = sections.find(s => s.label === teaserSection)?.start || totalDuration * 0.3;

    const requestedFormats = formats
      ? EXPORT_FORMATS.filter(f => formats.includes(f.key))
      : EXPORT_FORMATS.filter(f => f.key !== "square");

    // Build audio URL (resolve storage path to public URL)
    let audioPublicUrl = project.audio_url;
    if (audioPublicUrl && !audioPublicUrl.startsWith("http")) {
      const { data: urlData } = supabase.storage.from("audio-uploads").getPublicUrl(audioPublicUrl);
      audioPublicUrl = urlData?.publicUrl || null;
    }

    const manifest = {
      version: 3,
      type: "manifest_render",
      project_id,
      title: project.title,
      audio_url: audioPublicUrl,
      bpm,
      total_duration: totalDuration,
      beat_sync: {
        enabled: true,
        cuts: beatAlignedCuts,
        beat_grid: beats.map(b => b.time),
        bar_duration: 60 / bpm * 4,
      },
      shots: beatAlignedCuts.map(cut => {
        const shot = shots.find(s => s.idx === cut.idx);
        return {
          idx: cut.idx,
          url: shot?.output_url,
          start_sec: cut.start_sec,
          end_sec: cut.end_sec,
          duration_sec: cut.end_sec - cut.start_sec,
          transition: cut.transition,
        };
      }),
      outputs: Object.fromEntries(requestedFormats.map(f => [f.key, {
        width: f.width,
        height: f.height,
        format: "mp4",
        crop: f.crop || false,
        ...(f.key === "teaser" ? { duration: 15, start_sec: teaserStart } : {}),
      }])),
      transitions_config: {
        cut_on_beat: { type: "hard_cut" },
        crossfade: { type: "crossfade", duration_beats: 1 },
        flash_cut: { type: "flash", duration_frames: 2 },
      },
    };

    const thumbs = shots.slice(0, 6).map(s => s.output_url).filter(Boolean);

    // ─── Try external FFmpeg render service first ──
    const renderServiceUrl = Deno.env.get("FFMPEG_RENDER_SERVICE_URL");
    let renderResult: any = null;

    if (renderServiceUrl) {
      try {
        const res = await fetch(renderServiceUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(manifest),
        });
        renderResult = await res.json();
      } catch (err: any) {
        console.warn("External render service failed:", err.message);
      }
    }

    const hasExternalRender = renderResult?.master_url_16_9;

    if (hasExternalRender) {
      // Real render service returned URLs
      await supabase.from("renders").upsert({
        project_id,
        status: "completed",
        master_url_16_9: renderResult.master_url_16_9,
        master_url_9_16: renderResult.master_url_9_16 || null,
        teaser_url: renderResult.teaser_url || null,
        thumbs_json: thumbs,
        logs: JSON.stringify({
          manifest_version: 3,
          beat_sync_enabled: true,
          cuts_count: beatAlignedCuts.length,
          bpm,
          formats_requested: requestedFormats.map(f => f.key),
          stitched_at: new Date().toISOString(),
          render_mode: "external_service",
        }),
      }, { onConflict: "project_id" });
      await supabase.from("projects").update({ status: "completed" }).eq("id", project_id);
    } else {
      // ─── FREE CLIENT-SIDE RENDER: Upload manifest to storage ──
      // The frontend player will use this manifest for synchronized playback
      const manifestPath = `${project_id}/manifest.json`;
      const manifestBlob = new Blob([JSON.stringify(manifest)], { type: "application/json" });

      await supabase.storage.from("renders").upload(manifestPath, manifestBlob, {
        contentType: "application/json",
        upsert: true,
      });

      const { data: manifestUrlData } = supabase.storage.from("renders").getPublicUrl(manifestPath);
      const manifestUrl = manifestUrlData?.publicUrl;

      if (!manifestUrl) throw new Error("Failed to upload manifest");

      // Use manifest URL as master_url_16_9 — it's a real URL, not a placeholder
      // The frontend detects manifest.json URLs and renders the interactive player
      await supabase.from("renders").upsert({
        project_id,
        status: "completed",
        master_url_16_9: manifestUrl,
        master_url_9_16: manifestUrl,
        teaser_url: null,
        thumbs_json: thumbs,
        logs: JSON.stringify({
          manifest_version: 3,
          beat_sync_enabled: true,
          cuts_count: beatAlignedCuts.length,
          bpm,
          render_mode: "client_player",
          manifest_url: manifestUrl,
          stitched_at: new Date().toISOString(),
        }),
      }, { onConflict: "project_id" });

      await supabase.from("projects").update({ status: "completed" }).eq("id", project_id);
    }

    return new Response(JSON.stringify({
      success: true,
      shots_stitched: shots.length,
      beat_sync: { enabled: true, cuts: beatAlignedCuts.length, bpm },
      formats: requestedFormats.map(f => f.key),
      has_render_service: !!renderServiceUrl,
      render_completed: true,
      render_mode: hasExternalRender ? "external_service" : "client_player",
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