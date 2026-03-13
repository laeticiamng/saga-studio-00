import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;

export type RenderProgress = {
  stage: "loading" | "downloading" | "encoding" | "done" | "error";
  percent: number;
  message: string;
};

async function getFFmpeg(onProgress: (p: RenderProgress) => void): Promise<FFmpeg> {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;

  onProgress({ stage: "loading", percent: 0, message: "Chargement de FFmpeg…" });

  ffmpeg = new FFmpeg();

  ffmpeg.on("log", ({ message }) => {
    console.log("[ffmpeg]", message);
  });

  ffmpeg.on("progress", ({ progress }) => {
    onProgress({
      stage: "encoding",
      percent: Math.round(progress * 100),
      message: `Encodage : ${Math.round(progress * 100)}%`,
    });
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
  onProgress: (p: RenderProgress) => void
): Promise<Blob> {
  const ff = await getFFmpeg(onProgress);

  // Download all shot media files
  const validShots = shots.filter(s => s.url && !s.url.includes("placehold.co"));
  if (validShots.length === 0) {
    throw new Error("Aucun shot vidéo valide à assembler");
  }

  for (let i = 0; i < validShots.length; i++) {
    const shot = validShots[i];
    onProgress({
      stage: "downloading",
      percent: Math.round((i / validShots.length) * 100),
      message: `Téléchargement shot ${i + 1}/${validShots.length}…`,
    });

    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(shot.url);
    const ext = isImage ? "png" : "mp4";
    const filename = `shot_${i}.${ext}`;

    try {
      const data = await fetchFile(shot.url);
      await ff.writeFile(filename, data);
    } catch (err) {
      console.warn(`Failed to download shot ${i}:`, err);
    }
  }

  // Download audio if available
  if (audioUrl) {
    onProgress({ stage: "downloading", percent: 95, message: "Téléchargement audio…" });
    try {
      const audioData = await fetchFile(audioUrl);
      await ff.writeFile("audio.mp3", audioData);
    } catch (err) {
      console.warn("Failed to download audio:", err);
    }
  }

  // Build concat file for FFmpeg
  let concatContent = "";
  for (let i = 0; i < validShots.length; i++) {
    const shot = validShots[i];
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(shot.url);
    const ext = isImage ? "png" : "mp4";
    const filename = `shot_${i}.${ext}`;
    const duration = shot.duration_sec || 5;

    if (isImage) {
      // For images, we need to create a video from the image
      onProgress({
        stage: "encoding",
        percent: Math.round((i / validShots.length) * 30),
        message: `Conversion image ${i + 1} en vidéo…`,
      });
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
      concatContent += `file 'segment_${i}.mp4'\n`;
    } else {
      // Re-encode video to ensure compatible format
      onProgress({
        stage: "encoding",
        percent: Math.round((i / validShots.length) * 30),
        message: `Normalisation shot ${i + 1}…`,
      });
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
      concatContent += `file 'segment_${i}.mp4'\n`;
    }
  }

  // Write concat file
  const encoder = new TextEncoder();
  await ff.writeFile("concat.txt", encoder.encode(concatContent));

  onProgress({ stage: "encoding", percent: 50, message: "Assemblage des segments…" });

  // Concat all segments
  if (audioUrl) {
    await ff.exec([
      "-f", "concat",
      "-safe", "0",
      "-i", "concat.txt",
      "-i", "audio.mp3",
      "-c:v", "libx264",
      "-c:a", "aac",
      "-shortest",
      "-pix_fmt", "yuv420p",
      "output.mp4",
    ]);
  } else {
    await ff.exec([
      "-f", "concat",
      "-safe", "0",
      "-i", "concat.txt",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "output.mp4",
    ]);
  }

  onProgress({ stage: "encoding", percent: 95, message: "Finalisation…" });

  // Read output
  const data = await ff.readFile("output.mp4");
  const uint8 = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
  const blob = new Blob([uint8.buffer], { type: "video/mp4" });

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

  onProgress({ stage: "done", percent: 100, message: "Vidéo prête !" });
  return blob;
}
