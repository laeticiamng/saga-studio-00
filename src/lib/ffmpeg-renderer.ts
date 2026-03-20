import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";
import { supabase } from "@/integrations/supabase/client";

/** Fetch a file, proxying external URLs through the edge function to avoid CORS */
async function fetchFileProxy(url: string): Promise<Uint8Array> {
  // Local / same-origin URLs can be fetched directly
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const isSameOrigin = url.startsWith("/") || url.startsWith(window.location.origin) || url.startsWith(supabaseUrl);

  if (isSameOrigin) {
    return fetchFile(url);
  }

  // External URL → proxy through edge function
  const { data, error } = await supabase.functions.invoke("proxy-media", {
    body: { url },
  });

  if (error) {
    throw new Error(`Proxy fetch failed: ${error.message}`);
  }

  // data is already an ArrayBuffer or Blob from the edge function
  if (data instanceof Blob) {
    return new Uint8Array(await data.arrayBuffer());
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  // Fallback: try fetchFile directly
  return fetchFile(url);
}

let ffmpeg: FFmpeg | null = null;

export type RenderStage = "loading" | "downloading" | "encoding_segments" | "concat" | "done" | "error";

export type RenderProgress = {
  stage: RenderStage;
  percent: number;
  message: string;
  /** Estimated time remaining in seconds, null if unknown */
  etaSeconds: number | null;
  /** Current step index (e.g. shot 3 of 10) */
  stepIndex?: number;
  /** Total steps in current stage */
  stepTotal?: number;
  /** Elapsed time in ms since render started */
  elapsedMs: number;
};

/** Simple timer helper to compute ETA from step progress */
class ETATracker {
  private startTime: number;
  constructor() { this.startTime = Date.now(); }
  reset() { this.startTime = Date.now(); }
  elapsed() { return Date.now() - this.startTime; }
  /** Estimate remaining seconds given fraction done (0–1) */
  estimate(fractionDone: number): number | null {
    if (fractionDone <= 0.01) return null;
    const elapsed = this.elapsed() / 1000;
    const total = elapsed / fractionDone;
    return Math.max(0, Math.round(total - elapsed));
  }
}

function formatETA(seconds: number | null): string {
  if (seconds === null) return "";
  if (seconds < 5) return " — quelques secondes";
  if (seconds < 60) return ` — ~${seconds}s restantes`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return ` — ~${min}min ${sec}s restantes`;
}

async function getFFmpeg(onProgress: (p: Partial<RenderProgress>) => void): Promise<FFmpeg> {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;

  onProgress({ stage: "loading", percent: 0, message: "Chargement de FFmpeg (≈30 Mo)…" });

  ffmpeg = new FFmpeg();

  ffmpeg.on("log", ({ message }) => {
    console.log("[ffmpeg]", message);
  });

  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  onProgress({ stage: "loading", percent: 100, message: "FFmpeg prêt" });
  return ffmpeg;
}

interface ShotInput {
  idx: number;
  url: string;
  duration_sec: number;
}

export async function renderVideo(
  shots: ShotInput[],
  audioUrl: string | null,
  onProgress: (p: RenderProgress) => void,
  signal?: AbortSignal
): Promise<Blob> {
  const globalTimer = new ETATracker();
  const stageTimer = new ETATracker();

  const emit = (partial: Omit<RenderProgress, "elapsedMs">): void => {
    onProgress({ ...partial, elapsedMs: globalTimer.elapsed() });
  };

  const checkAbort = () => {
    if (signal?.aborted) throw new Error("Assemblage annulé");
  };

  const ff = await getFFmpeg((p) => emit({
    stage: p.stage || "loading",
    percent: p.percent || 0,
    message: p.message || "",
    etaSeconds: null,
  }));

  // Register FFmpeg progress for concat stage
  let concatActive = false;
  ff.on("progress", ({ progress }) => {
    if (concatActive) {
      const pct = Math.round(progress * 100);
      const eta = stageTimer.estimate(progress);
      emit({
        stage: "concat",
        percent: pct,
        message: `Assemblage final : ${pct}%${formatETA(eta)}`,
        etaSeconds: eta,
      });
    }
  });

  // ── STAGE 1: Download ──
  const validShots = shots.filter(s => s.url && !s.url.includes("placehold.co"));
  if (validShots.length === 0) {
    throw new Error("Aucun shot vidéo valide à assembler");
  }

  const totalDownloads = validShots.length + (audioUrl ? 1 : 0);
  stageTimer.reset();
  let downloadFailures = 0;

  for (let i = 0; i < validShots.length; i++) {
    checkAbort();
    const shot = validShots[i];
    const fraction = i / totalDownloads;
    const eta = stageTimer.estimate(fraction);
    emit({
      stage: "downloading",
      percent: Math.round(fraction * 100),
      message: `Téléchargement shot ${i + 1}/${validShots.length}${formatETA(eta)}`,
      etaSeconds: eta,
      stepIndex: i + 1,
      stepTotal: validShots.length,
    });

    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(shot.url);
    const ext = isImage ? "png" : "mp4";
    const filename = `shot_${i}.${ext}`;

    try {
      const data = await fetchFileProxy(shot.url);
      if (data.length < 100) {
        throw new Error(`Shot ${i + 1}: fichier trop petit (${data.length} octets)`);
      }
      await ff.writeFile(filename, data);
    } catch (err: unknown) {
      downloadFailures++;
      console.error(`Failed to download shot ${i}:`, err);
      // Mark this shot as failed but continue — we'll check threshold after
      if (downloadFailures > validShots.length * 0.5) {
        throw new Error(`Trop d'échecs de téléchargement (${downloadFailures}/${validShots.length}). Vérifiez que les URLs des shots sont accessibles.`);
      }
    }
  }

  if (audioUrl) {
    const eta = stageTimer.estimate(validShots.length / totalDownloads);
    emit({
      stage: "downloading",
      percent: 95,
      message: `Téléchargement audio…${formatETA(eta)}`,
      etaSeconds: eta,
      stepIndex: totalDownloads,
      stepTotal: totalDownloads,
    });
    try {
      const audioData = await fetchFileProxy(audioUrl);
      await ff.writeFile("audio.mp3", audioData);
    } catch (err) {
      console.warn("Failed to download audio:", err);
    }
  }

  // ── STAGE 2: Encode segments ──
  let concatContent = "";
  stageTimer.reset();

  for (let i = 0; i < validShots.length; i++) {
    checkAbort();
    const shot = validShots[i];
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(shot.url);
    const ext = isImage ? "png" : "mp4";
    const filename = `shot_${i}.${ext}`;
    const duration = shot.duration_sec || 5;
    const fraction = i / validShots.length;
    const eta = stageTimer.estimate(fraction);

    emit({
      stage: "encoding_segments",
      percent: Math.round(fraction * 100),
      message: `${isImage ? "Conversion image" : "Normalisation"} ${i + 1}/${validShots.length}${formatETA(eta)}`,
      etaSeconds: eta,
      stepIndex: i + 1,
      stepTotal: validShots.length,
    });

    if (isImage) {
      await ff.exec([
        "-loop", "1",
        "-i", filename,
        "-c:v", "libx264",
        "-t", String(duration),
        "-pix_fmt", "yuv420p",
        "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
        "-r", "24",
        `segment_${i}.mp4`,
      ]);
    } else {
      await ff.exec([
        "-i", filename,
        "-c:v", "libx264",
        "-t", String(duration),
        "-pix_fmt", "yuv420p",
        "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
        "-r", "24",
        "-an",
        `segment_${i}.mp4`,
      ]);
    }
    concatContent += `file 'segment_${i}.mp4'\n`;
  }

  // ── STAGE 3: Concat ──
  const encoder = new TextEncoder();
  await ff.writeFile("concat.txt", encoder.encode(concatContent));

  stageTimer.reset();
  concatActive = true;

  emit({
    stage: "concat",
    percent: 0,
    message: "Assemblage final des segments…",
    etaSeconds: null,
  });

  if (audioUrl) {
    await ff.exec([
      "-f", "concat", "-safe", "0", "-i", "concat.txt",
      "-i", "audio.mp3",
      "-c:v", "libx264", "-c:a", "aac", "-shortest", "-pix_fmt", "yuv420p",
      "output.mp4",
    ]);
  } else {
    await ff.exec([
      "-f", "concat", "-safe", "0", "-i", "concat.txt",
      "-c:v", "libx264", "-pix_fmt", "yuv420p",
      "output.mp4",
    ]);
  }

  concatActive = false;

  emit({ stage: "concat", percent: 100, message: "Finalisation…", etaSeconds: 0 });

  // Read output
  const data = await ff.readFile("output.mp4");
  const uint8 = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
  const arrayBuffer = uint8.slice().buffer as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: "video/mp4" });

  // Cleanup
  for (let i = 0; i < validShots.length; i++) {
    try {
      const isImage = /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(validShots[i].url);
      await ff.deleteFile(`shot_${i}.${isImage ? "png" : "mp4"}`);
      await ff.deleteFile(`segment_${i}.mp4`);
    } catch {}
  }
  try { await ff.deleteFile("concat.txt"); } catch {}
  try { await ff.deleteFile("audio.mp3"); } catch {}
  try { await ff.deleteFile("output.mp4"); } catch {}

  const totalSeconds = Math.round(globalTimer.elapsed() / 1000);
  emit({ stage: "done", percent: 100, message: `Vidéo prête ! (${totalSeconds}s)`, etaSeconds: 0 });
  return blob;
}
