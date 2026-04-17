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
        render_mode: "none",
        logs: JSON.stringify({ error: "No completed shots to stitch", failed_at: new Date().toISOString() }),
      }, { onConflict: "project_id" });
      await supabase.from("projects").update({ status: "failed" }).eq("id", project_id);
      throw new Error("No completed shots to stitch");
    }

    // Categorize shots by provider type
    const imageShots = shots.filter(s => s.provider_type === "image" || s.provider === "sora");
    const videoShots = shots.filter(s => s.provider_type === "video" && s.provider !== "sora");
    const hasRealVideo = videoShots.length > 0;

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

    // Build audio URL
    let audioPublicUrl = project.audio_url;
    if (audioPublicUrl && !audioPublicUrl.startsWith("http")) {
      const { data: urlData } = supabase.storage.from("audio-uploads").getPublicUrl(audioPublicUrl);
      audioPublicUrl = urlData?.publicUrl || null;
    }

    const manifest = {
      version: 4,
      type: "manifest_render",
      project_id,
      title: project.title,
      audio_url: audioPublicUrl,
      bpm,
      total_duration: totalDuration,
      shot_types: {
        image_count: imageShots.length,
        video_count: videoShots.length,
        has_real_video: hasRealVideo,
      },
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
          provider: shot?.provider,
          provider_type: shot?.provider_type || (shot?.provider === "sora" ? "image" : "video"),
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

    // ─── Try external FFmpeg render service (with auto-fallback observability) ──
    const renderServiceUrl = Deno.env.get("FFMPEG_RENDER_SERVICE_URL");
    let renderResult: any = null;
    let fallbackForced = false;

    // Check current renderer health state — if fallback is active, skip external call
    if (renderServiceUrl) {
      const { data: stateData } = await supabase.rpc("get_renderer_fallback_state");
      if (stateData?.fallback_active) {
        fallbackForced = true;
        console.log("[stitch-render] Fallback active (consecutive_failures=" + stateData.consecutive_failures + ") — skipping external render");
      }
    }

    if (renderServiceUrl && !fallbackForced) {
      try {
        console.log("[stitch-render] Attempting external render service:", renderServiceUrl);
        const res = await fetch(renderServiceUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(manifest),
          signal: AbortSignal.timeout(120_000),
        });
        if (res.ok) {
          renderResult = await res.json();
          console.log("[stitch-render] External render result:", JSON.stringify(renderResult));
          // Report success — resets the failure counter
          await supabase.rpc("report_renderer_health", { p_success: true, p_notes: null });
        } else {
          const errText = await res.text();
          console.warn("[stitch-render] External render service returned", res.status, errText);
          await supabase.rpc("report_renderer_health", {
            p_success: false,
            p_notes: `HTTP ${res.status}: ${errText.slice(0, 200)}`,
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.warn("[stitch-render] External render service failed:", message);
        await supabase.rpc("report_renderer_health", {
          p_success: false,
          p_notes: message.slice(0, 200),
        });
      }
    }

    const hasExternalRender = renderResult?.master_url_16_9 && !renderResult.master_url_16_9.includes("manifest.json");

    if (hasExternalRender) {
      // ─── PATH A: Server render completed — real MP4 exists ──
      console.log("[stitch-render] PATH A: Server render with real MP4");
      await supabase.from("renders").upsert({
        project_id,
        status: "completed",
        render_mode: "server",
        master_url_16_9: renderResult.master_url_16_9,
        master_url_9_16: renderResult.master_url_9_16 || null,
        teaser_url: renderResult.teaser_url || null,
        manifest_url: null,
        thumbs_json: thumbs,
        logs: JSON.stringify({
          manifest_version: 4,
          beat_sync_enabled: true,
          cuts_count: beatAlignedCuts.length,
          bpm,
          formats_requested: requestedFormats.map(f => f.key),
          stitched_at: new Date().toISOString(),
          render_mode: "server",
          shot_types: manifest.shot_types,
        }),
      }, { onConflict: "project_id" });
      await supabase.from("projects").update({ status: "completed" }).eq("id", project_id);

      return jsonResponse({
        success: true,
        render_mode: "server",
        shots_stitched: shots.length,
        beat_sync: { enabled: true, cuts: beatAlignedCuts.length, bpm },
        formats: requestedFormats.map(f => f.key),
      });
    } else {
      // ─── PATH B: Client assembly required — upload manifest, NO fake master URL ──
      console.log("[stitch-render] PATH B: Client assembly mode" + (fallbackForced ? " (FORCED by renderer fallback)" : ""));

      // Diagnostic event when fallback was forced (for admin visibility)
      if (fallbackForced) {
        await supabase.from("diagnostic_events").insert({
          project_id,
          severity: "warning",
          scope: "infrastructure",
          event_type: "renderer_fallback_engaged",
          title: "Bascule renderer activée",
          detail: "Le service FFmpeg externe est dégradé — assemblage client utilisé.",
          raw_data: { project_id, render_mode: "client_assembly_forced" },
        });
      }

      const manifestPath = `${project_id}/manifest.json`;
      const manifestJson = JSON.stringify(manifest);
      const encoder = new TextEncoder();
      const manifestBytes = encoder.encode(manifestJson);

      const { error: uploadError } = await supabase.storage.from("renders").upload(manifestPath, manifestBytes, {
        contentType: "application/json",
        upsert: true,
      });

      if (uploadError) {
        console.error("[stitch-render] Manifest upload error:", uploadError.message);
      }

      const { data: manifestUrlData } = supabase.storage.from("renders").getPublicUrl(manifestPath);
      const manifestUrl = manifestUrlData?.publicUrl;

      if (!manifestUrl) {
        throw new Error("Failed to upload manifest");
      }

      console.log("[stitch-render] Manifest uploaded:", manifestUrl);

      // Store manifest separately — DO NOT write it as master_url
      await supabase.from("renders").upsert({
        project_id,
        status: "completed",
        render_mode: "client_assembly",
        manifest_url: manifestUrl,
        master_url_16_9: null,  // No real server MP4
        master_url_9_16: null,
        teaser_url: null,
        thumbs_json: thumbs,
        logs: JSON.stringify({
          manifest_version: 4,
          beat_sync_enabled: true,
          cuts_count: beatAlignedCuts.length,
          bpm,
          render_mode: "client_assembly",
          fallback_forced: fallbackForced,
          manifest_url: manifestUrl,
          stitched_at: new Date().toISOString(),
          shot_types: manifest.shot_types,
          note: fallbackForced
            ? "Renderer externe dégradé — bascule auto vers client-assembly."
            : "No external render service configured. Client-side FFmpeg assembly required.",
        }),
      }, { onConflict: "project_id" });

      // Project is "completed" but render_mode tells the UI that client assembly is needed
      await supabase.from("projects").update({ status: "completed" }).eq("id", project_id);

      return jsonResponse({
        success: true,
        render_mode: "client_assembly",
        fallback_forced: fallbackForced,
        shots_stitched: shots.length,
        beat_sync: { enabled: true, cuts: beatAlignedCuts.length, bpm },
        manifest_url: manifestUrl,
        note: fallbackForced
          ? "External renderer degraded — auto-switched to client assembly."
          : "No external render service. Use browser FFmpeg to assemble the final video.",
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[stitch-render] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
