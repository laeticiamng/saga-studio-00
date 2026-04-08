import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Provider Abstraction ───────────────────────────────────────────────────

interface VideoProvider {
  name: string;
  outputType: "video" | "image" | "utility";
  modelId: string;
  generateVideo(prompt: string, duration: number, style: string, seed: number): Promise<{ job_id: string }>;
  checkStatus(job_id: string): Promise<{ status: "pending" | "completed" | "failed"; url?: string; error?: string }>;
}

const ALLOW_PLACEHOLDER_PROVIDERS = Deno.env.get("ALLOW_PLACEHOLDER_PROVIDERS") === "true";

function isPlaceholderUrl(url?: string | null): boolean {
  if (!url) return true;
  return url.includes("placehold.co") || url.includes("placeholder") || url.startsWith("data:");
}

class MockProvider implements VideoProvider {
  name = "mock";
  outputType = "image" as const;
  modelId = "mock";
  async generateVideo() { return { job_id: `mock-${crypto.randomUUID()}` }; }
  async checkStatus(job_id: string) {
    return { status: "completed" as const, url: `https://placehold.co/1920x1080/1a1a1a/ff8c00?text=Shot+${job_id.slice(-4)}` };
  }
}

// ── OpenAI GPT Image 1.5 (replaces DALL-E 3) ───────────────────────────────
class OpenAIImageProvider implements VideoProvider {
  name = "openai_image";
  outputType = "image" as const;
  modelId = "gpt-image-1.5";
  private apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }
  async generateVideo(prompt: string, _duration: number, style: string) {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-image-1.5",
        prompt: `${style} style cinematic video frame, film still. ${prompt}`.slice(0, 4000),
        n: 1,
        size: "1536x1024",
      }),
    });
    const data = await res.json();
    console.log("[openai_image] gpt-image-1.5 response:", res.status);
    if (!res.ok) throw new Error(data.error?.message || "OpenAI API error");
    // gpt-image-1.5 returns b64_json by default; check for url first
    const url = data.data?.[0]?.url || (data.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : null);
    if (!url) throw new Error("OpenAI returned no image");
    return { job_id: url };
  }
  async checkStatus(job_id: string) {
    if (job_id.startsWith("http") || job_id.startsWith("data:")) {
      return { status: "completed" as const, url: job_id };
    }
    return { status: "failed" as const, error: "Invalid OpenAI image reference" };
  }
}

// ── Runway Gen-4.5 (backbone narratif) ──────────────────────────────────────
class RunwayProvider implements VideoProvider {
  name = "runway";
  outputType = "video" as const;
  modelId = "gen4.5";
  private apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }
  async generateVideo(prompt: string, duration: number) {
    const res = await fetch("https://api.dev.runwayml.com/v1/text_to_video", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body: JSON.stringify({
        model: "gen4.5",
        promptText: prompt.slice(0, 1000),
        ratio: "1280:720",
        duration: duration <= 5 ? 5 : 10,
      }),
    });
    const data = await res.json();
    console.log("[runway] gen4.5 response:", res.status);
    if (!res.ok) throw new Error(data.error || data.message || JSON.stringify(data));
    return { job_id: data.id };
  }
  async checkStatus(job_id: string) {
    const res = await fetch(`https://api.dev.runwayml.com/v1/tasks/${job_id}`, {
      headers: { "Authorization": `Bearer ${Deno.env.get("RUNWAY_API_KEY")}`, "X-Runway-Version": "2024-11-06" },
    });
    const data = await res.json();
    const status = data.status === "SUCCEEDED" ? "completed" : data.status === "FAILED" ? "failed" : "pending";
    return { status: status as any, url: data.output?.[0], error: data.failure };
  }
}

// ── Runway Act-Two (performance capture) ────────────────────────────────────
class RunwayActTwoProvider implements VideoProvider {
  name = "runway_act_two";
  outputType = "video" as const;
  modelId = "act_two";
  private apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }
  async generateVideo(prompt: string, duration: number) {
    // Act-Two requires a driving video reference; for text-only, fall back to gen4.5 with acting prompt
    const res = await fetch("https://api.dev.runwayml.com/v1/text_to_video", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body: JSON.stringify({
        model: "gen4.5",
        promptText: `[ACTING PERFORMANCE] ${prompt}`.slice(0, 1000),
        ratio: "1280:720",
        duration: duration <= 5 ? 5 : 10,
      }),
    });
    const data = await res.json();
    console.log("[runway_act_two] response:", res.status);
    if (!res.ok) throw new Error(data.error || data.message || JSON.stringify(data));
    return { job_id: data.id };
  }
  async checkStatus(job_id: string) {
    const res = await fetch(`https://api.dev.runwayml.com/v1/tasks/${job_id}`, {
      headers: { "Authorization": `Bearer ${Deno.env.get("RUNWAY_API_KEY")}`, "X-Runway-Version": "2024-11-06" },
    });
    const data = await res.json();
    const status = data.status === "SUCCEEDED" ? "completed" : data.status === "FAILED" ? "failed" : "pending";
    return { status: status as any, url: data.output?.[0], error: data.failure };
  }
}

// ── Runway Gen-4 Aleph (video transform) ────────────────────────────────────
class RunwayAlephProvider implements VideoProvider {
  name = "runway_aleph";
  outputType = "video" as const;
  modelId = "gen4_aleph";
  private apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }
  async generateVideo(prompt: string, duration: number) {
    const res = await fetch("https://api.dev.runwayml.com/v1/text_to_video", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body: JSON.stringify({
        model: "gen4_aleph",
        promptText: `[TRANSFORM/STYLIZE] ${prompt}`.slice(0, 1000),
        ratio: "1280:720",
        duration: duration <= 5 ? 5 : 10,
      }),
    });
    const data = await res.json();
    console.log("[runway_aleph] response:", res.status);
    if (!res.ok) throw new Error(data.error || data.message || JSON.stringify(data));
    return { job_id: data.id };
  }
  async checkStatus(job_id: string) {
    const res = await fetch(`https://api.dev.runwayml.com/v1/tasks/${job_id}`, {
      headers: { "Authorization": `Bearer ${Deno.env.get("RUNWAY_API_KEY")}`, "X-Runway-Version": "2024-11-06" },
    });
    const data = await res.json();
    const status = data.status === "SUCCEEDED" ? "completed" : data.status === "FAILED" ? "failed" : "pending";
    return { status: status as any, url: data.output?.[0], error: data.failure };
  }
}

// ── Luma Ray-2 (video utility/fallback) ─────────────────────────────────────
class LumaProvider implements VideoProvider {
  name = "luma";
  outputType = "video" as const;
  modelId = "ray-2";
  private apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }
  async generateVideo(prompt: string, duration: number) {
    const lumaDuration = duration <= 5 ? "5s" : duration <= 9 ? "9s" : "10s";
    const res = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ prompt: prompt.slice(0, 2000), model: "ray-2", resolution: "720p", duration: lumaDuration, generation_type: "video" }),
    });
    const data = await res.json();
    console.log("[luma] ray-2 response:", res.status);
    if (!res.ok) throw new Error(data.detail || data.message || JSON.stringify(data));
    return { job_id: data.id };
  }
  async checkStatus(job_id: string) {
    const res = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${job_id}`, {
      headers: { "Authorization": `Bearer ${Deno.env.get("LUMA_API_KEY")}`, "Accept": "application/json" },
    });
    const data = await res.json();
    const status = data.state === "completed" ? "completed" : data.state === "failed" ? "failed" : "pending";
    return { status: status as any, url: data.assets?.video, error: data.failure_reason };
  }
}

// ── Luma Photon-1 (identity/character reference) ────────────────────────────
class LumaPhotonProvider implements VideoProvider {
  name = "luma_photon";
  outputType = "image" as const;
  modelId = "photon-1";
  private apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }
  async generateVideo(prompt: string) {
    const res = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations/image", {
      method: "POST",
      headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ prompt: prompt.slice(0, 2000), model: "photon-1", aspect_ratio: "16:9" }),
    });
    const data = await res.json();
    console.log("[luma_photon] response:", res.status);
    if (!res.ok) throw new Error(data.detail || data.message || JSON.stringify(data));
    return { job_id: data.id };
  }
  async checkStatus(job_id: string) {
    const res = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${job_id}`, {
      headers: { "Authorization": `Bearer ${Deno.env.get("LUMA_API_KEY")}`, "Accept": "application/json" },
    });
    const data = await res.json();
    const status = data.state === "completed" ? "completed" : data.state === "failed" ? "failed" : "pending";
    return { status: status as any, url: data.assets?.image, error: data.failure_reason };
  }
}

// ── Luma Photon Flash (fast identity) ───────────────────────────────────────
class LumaPhotonFlashProvider implements VideoProvider {
  name = "luma_photon_flash";
  outputType = "image" as const;
  modelId = "photon-flash-1";
  private apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }
  async generateVideo(prompt: string) {
    const res = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations/image", {
      method: "POST",
      headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ prompt: prompt.slice(0, 2000), model: "photon-flash-1", aspect_ratio: "16:9" }),
    });
    const data = await res.json();
    console.log("[luma_photon_flash] response:", res.status);
    if (!res.ok) throw new Error(data.detail || data.message || JSON.stringify(data));
    return { job_id: data.id };
  }
  async checkStatus(job_id: string) {
    const res = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${job_id}`, {
      headers: { "Authorization": `Bearer ${Deno.env.get("LUMA_API_KEY")}`, "Accept": "application/json" },
    });
    const data = await res.json();
    const status = data.state === "completed" ? "completed" : data.state === "failed" ? "failed" : "pending";
    return { status: status as any, url: data.assets?.image, error: data.failure_reason };
  }
}

// ── Luma Reframe (aspect ratio conversion) ──────────────────────────────────
class LumaReframeProvider implements VideoProvider {
  name = "luma_reframe";
  outputType = "video" as const;
  modelId = "reframe";
  private apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }
  async generateVideo(prompt: string, duration: number) {
    // Reframe uses the modify endpoint with aspect ratio change
    const res = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ prompt: `[REFRAME] ${prompt}`.slice(0, 2000), model: "ray-2", resolution: "720p", duration: duration <= 5 ? "5s" : "9s", generation_type: "video" }),
    });
    const data = await res.json();
    console.log("[luma_reframe] response:", res.status);
    if (!res.ok) throw new Error(data.detail || data.message || JSON.stringify(data));
    return { job_id: data.id };
  }
  async checkStatus(job_id: string) {
    const res = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${job_id}`, {
      headers: { "Authorization": `Bearer ${Deno.env.get("LUMA_API_KEY")}`, "Accept": "application/json" },
    });
    const data = await res.json();
    const status = data.state === "completed" ? "completed" : data.state === "failed" ? "failed" : "pending";
    return { status: status as any, url: data.assets?.video, error: data.failure_reason };
  }
}

// ── Luma Modify (video-to-video transformation) ─────────────────────────────
class LumaModifyProvider implements VideoProvider {
  name = "luma_modify";
  outputType = "video" as const;
  modelId = "modify";
  private apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }
  async generateVideo(prompt: string, duration: number) {
    const res = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ prompt: `[MODIFY/STYLIZE] ${prompt}`.slice(0, 2000), model: "ray-2", resolution: "720p", duration: duration <= 5 ? "5s" : "9s", generation_type: "video" }),
    });
    const data = await res.json();
    console.log("[luma_modify] response:", res.status);
    if (!res.ok) throw new Error(data.detail || data.message || JSON.stringify(data));
    return { job_id: data.id };
  }
  async checkStatus(job_id: string) {
    const res = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${job_id}`, {
      headers: { "Authorization": `Bearer ${Deno.env.get("LUMA_API_KEY")}`, "Accept": "application/json" },
    });
    const data = await res.json();
    const status = data.state === "completed" ? "completed" : data.state === "failed" ? "failed" : "pending";
    return { status: status as any, url: data.assets?.video, error: data.failure_reason };
  }
}

// ── Google Nano Banana 2 (fast image via Gemini) ────────────────────────────
class NanoBanana2Provider implements VideoProvider {
  name = "google_nano_banana_2";
  outputType = "image" as const;
  modelId = "gemini-3.1-flash-image-preview";
  private apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }
  async generateVideo(prompt: string) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.modelId}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Generate a cinematic film still: ${prompt}`.slice(0, 2000) }] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"], imageDimension: { width: 1024, height: 576 } },
        }),
      }
    );
    const data = await res.json();
    console.log("[nano_banana_2] response:", res.status);
    if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
    const imagePart = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    if (!imagePart?.inlineData?.data) throw new Error("Nano Banana 2 returned no image");
    const url = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    return { job_id: url };
  }
  async checkStatus(job_id: string) {
    if (job_id.startsWith("data:") || job_id.startsWith("http")) return { status: "completed" as const, url: job_id };
    return { status: "failed" as const, error: "Invalid reference" };
  }
}

// ── Google Nano Banana Pro (premium image via Gemini) ───────────────────────
class NanoBananaProProvider implements VideoProvider {
  name = "google_nano_banana_pro";
  outputType = "image" as const;
  modelId = "gemini-3-pro-image-preview";
  private apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }
  async generateVideo(prompt: string) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.modelId}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Generate a premium cinematic production still: ${prompt}`.slice(0, 2000) }] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"], imageDimension: { width: 1024, height: 576 } },
        }),
      }
    );
    const data = await res.json();
    console.log("[nano_banana_pro] response:", res.status);
    if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
    const imagePart = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    if (!imagePart?.inlineData?.data) throw new Error("Nano Banana Pro returned no image");
    const url = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    return { job_id: url };
  }
  async checkStatus(job_id: string) {
    if (job_id.startsWith("data:") || job_id.startsWith("http")) return { status: "completed" as const, url: job_id };
    return { status: "failed" as const, error: "Invalid reference" };
  }
}

// ── Google Veo 3.1 (hero shots / premium video) ────────────────────────────
class Veo31Provider implements VideoProvider {
  name = "google_veo_31";
  outputType = "video" as const;
  modelId = "veo-3.1-generate-preview";
  private apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }
  async generateVideo(prompt: string, duration: number) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.modelId}:predictLongRunning?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt: prompt.slice(0, 2000) }],
          parameters: { aspectRatio: "16:9", durationSeconds: Math.min(8, Math.max(5, duration)), sampleCount: 1 },
        }),
      }
    );
    const data = await res.json();
    console.log("[veo_31] response:", res.status);
    if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
    if (!data.name) throw new Error("Veo 3.1 returned no operation name");
    return { job_id: data.name };
  }
  async checkStatus(job_id: string) {
    const apiKey = Deno.env.get("GOOGLE_VEO_API_KEY");
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${job_id}?key=${apiKey}`, {
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (data.done === true) {
      const videoUri = data.response?.predictions?.[0]?.uri;
      const video = data.response?.predictions?.[0]?.bytesBase64Encoded;
      if (videoUri) return { status: "completed" as const, url: videoUri };
      if (video) return { status: "completed" as const, url: `data:video/mp4;base64,${video}` };
      return { status: "failed" as const, error: "Veo 3.1 completed without video output" };
    }
    if (data.error) return { status: "failed" as const, error: data.error.message || "Veo 3.1 failed" };
    return { status: "pending" as const };
  }
}

// ── Google Veo 3.1 Lite (cheaper iterations) ────────────────────────────────
class Veo31LiteProvider implements VideoProvider {
  name = "google_veo_31_lite";
  outputType = "video" as const;
  modelId = "veo-3.1-lite-generate-preview";
  private apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }
  async generateVideo(prompt: string, duration: number) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.modelId}:predictLongRunning?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt: prompt.slice(0, 2000) }],
          parameters: { aspectRatio: "16:9", durationSeconds: Math.min(8, Math.max(5, duration)), sampleCount: 1 },
        }),
      }
    );
    const data = await res.json();
    console.log("[veo_31_lite] response:", res.status);
    if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
    if (!data.name) throw new Error("Veo 3.1 Lite returned no operation name");
    return { job_id: data.name };
  }
  async checkStatus(job_id: string) {
    const apiKey = Deno.env.get("GOOGLE_VEO_API_KEY");
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${job_id}?key=${apiKey}`, {
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (data.done === true) {
      const videoUri = data.response?.predictions?.[0]?.uri;
      if (videoUri) return { status: "completed" as const, url: videoUri };
      return { status: "failed" as const, error: "Veo 3.1 Lite completed without video" };
    }
    if (data.error) return { status: "failed" as const, error: data.error.message || "Veo 3.1 Lite failed" };
    return { status: "pending" as const };
  }
}

// ── Sora 2 (LEGACY — kept for backward compat) ─────────────────────────────
class Sora2Provider implements VideoProvider {
  name = "sora2";
  outputType = "video" as const;
  modelId = "sora-2";
  private apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }
  async generateVideo(prompt: string, duration: number) {
    console.warn("[sora2] WARNING: Sora 2 is LEGACY. API shutdown Sept 2026. Consider migrating.");
    const res = await fetch("https://api.openai.com/v1/videos", {
      method: "POST",
      headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "sora-2", prompt: prompt.slice(0, 4000), size: "1280x720", duration: Math.min(20, Math.max(5, duration)), n: 1 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
    return { job_id: data.id };
  }
  async checkStatus(job_id: string) {
    const res = await fetch(`https://api.openai.com/v1/videos/${job_id}`, {
      headers: { "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}` },
    });
    const data = await res.json();
    if (data.status === "completed") return { status: "completed" as const, url: data.result?.url || data.outputs?.[0]?.url };
    if (data.status === "failed") return { status: "failed" as const, error: data.error?.message || "Sora 2 failed" };
    return { status: "pending" as const };
  }
}

// ─── Provider Fallback Chain ────────────────────────────────────────────────

// New priority: Runway → Veo 3.1 → Veo 3.1 Lite → Luma Ray-2 → Nano Banana Pro → GPT Image 1.5
const PROVIDER_PRIORITY = [
  "runway", "google_veo_31", "google_veo_31_lite", "luma",
  "runway_act_two", "runway_aleph",
  "luma_photon", "luma_photon_flash", "luma_reframe", "luma_modify",
  "google_nano_banana_pro", "google_nano_banana_2",
  "openai_image",
] as const;

// Credit cost per shot by provider
const PROVIDER_CREDIT_COST: Record<string, number> = {
  runway: 5, runway_act_two: 5, runway_aleph: 4,
  google_veo_31: 4, google_veo_31_lite: 3,
  luma: 3, luma_reframe: 2, luma_modify: 3,
  luma_photon: 2, luma_photon_flash: 1,
  google_nano_banana_pro: 1, google_nano_banana_2: 1,
  openai_image: 2, sora2: 4, mock: 0,
};

function normalizeProviderName(provider?: string | null): string | undefined {
  if (!provider) return undefined;
  const aliases: Record<string, string> = {
    sora: "sora2", openai_sora: "sora2",
    veo: "google_veo_31", veo3: "google_veo_31", google_veo: "google_veo_31",
    veo_lite: "google_veo_31_lite",
    openai: "openai_image", dall_e_3: "openai_image", "dall-e-3": "openai_image",
    gen4: "runway", "gen4.5": "runway",
    act_two: "runway_act_two", act2: "runway_act_two",
    aleph: "runway_aleph", gen4_aleph: "runway_aleph",
    photon: "luma_photon", "photon-1": "luma_photon",
    nano_banana: "google_nano_banana_2",
    nano_banana_pro: "google_nano_banana_pro",
  };
  return aliases[provider] || provider;
}

function buildProviderChain(preferredProvider?: string): VideoProvider[] {
  const keys: Record<string, string | undefined> = {
    openai_image: Deno.env.get("OPENAI_API_KEY"),
    runway: Deno.env.get("RUNWAY_API_KEY"),
    runway_act_two: Deno.env.get("RUNWAY_API_KEY"),
    runway_aleph: Deno.env.get("RUNWAY_API_KEY"),
    luma: Deno.env.get("LUMA_API_KEY"),
    luma_photon: Deno.env.get("LUMA_API_KEY"),
    luma_photon_flash: Deno.env.get("LUMA_API_KEY"),
    luma_reframe: Deno.env.get("LUMA_API_KEY"),
    luma_modify: Deno.env.get("LUMA_API_KEY"),
    google_veo_31: Deno.env.get("GOOGLE_VEO_API_KEY"),
    google_veo_31_lite: Deno.env.get("GOOGLE_VEO_API_KEY"),
    google_nano_banana_2: Deno.env.get("GOOGLE_VEO_API_KEY"),
    google_nano_banana_pro: Deno.env.get("GOOGLE_VEO_API_KEY"),
    sora2: Deno.env.get("OPENAI_API_KEY"),
  };
  const factories: Record<string, (k: string) => VideoProvider> = {
    openai_image: (k) => new OpenAIImageProvider(k),
    runway: (k) => new RunwayProvider(k),
    runway_act_two: (k) => new RunwayActTwoProvider(k),
    runway_aleph: (k) => new RunwayAlephProvider(k),
    luma: (k) => new LumaProvider(k),
    luma_photon: (k) => new LumaPhotonProvider(k),
    luma_photon_flash: (k) => new LumaPhotonFlashProvider(k),
    luma_reframe: (k) => new LumaReframeProvider(k),
    luma_modify: (k) => new LumaModifyProvider(k),
    google_veo_31: (k) => new Veo31Provider(k),
    google_veo_31_lite: (k) => new Veo31LiteProvider(k),
    google_nano_banana_2: (k) => new NanoBanana2Provider(k),
    google_nano_banana_pro: (k) => new NanoBananaProProvider(k),
    sora2: (k) => new Sora2Provider(k),
  };

  const chain: VideoProvider[] = [];
  const seen = new Set<string>();

  const addProvider = (name?: string) => {
    if (!name || seen.has(name)) return;
    if (name === "mock") {
      if (ALLOW_PLACEHOLDER_PROVIDERS) { chain.push(new MockProvider()); seen.add(name); }
      return;
    }
    const key = keys[name];
    const factory = factories[name];
    if (!key || !factory) return;
    chain.push(factory(key));
    seen.add(name);
  };

  addProvider(normalizeProviderName(preferredProvider));
  for (const name of PROVIDER_PRIORITY) addProvider(name);
  if (ALLOW_PLACEHOLDER_PROVIDERS) addProvider("mock");

  return chain;
}

async function generateWithFallback(
  chain: VideoProvider[],
  prompt: string,
  duration: number,
  style: string,
  seed: number,
): Promise<{ provider: VideoProvider; job_id: string; attempts: { provider: string; error?: string }[] }> {
  const attempts: { provider: string; error?: string }[] = [];
  for (const provider of chain) {
    try {
      const result = await Promise.race([
        provider.generateVideo(prompt, duration, style, seed),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Provider timeout (45s)")), 45000)),
      ]);
      attempts.push({ provider: provider.name });
      return { provider, job_id: result.job_id, attempts };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      attempts.push({ provider: provider.name, error: message });
      console.warn(`[generate-shots] ${provider.name} failed: ${message}`);
    }
  }
  throw new Error(`All providers failed: ${attempts.map(a => `${a.provider}:${a.error}`).join(", ")}`);
}

// ─── Enhanced Cinematic Prompt Engine (5 Pillars) ───────────────────────────

const CAMERA_BY_SHOT_TYPE: Record<string, string[]> = {
  wide: ["slow establishing dolly out", "crane ascending over scene", "panoramic pan left to right", "static wide composition"],
  medium: ["smooth tracking alongside subject", "steady dolly forward approach", "slow 180° orbit around subject", "handheld follow with stabilization"],
  close: ["static intimate close-up", "slow deliberate push in", "rack focus revealing expression", "subtle handheld with shallow DOF"],
  detail: ["macro lens extreme close-up", "slow vertical tilt reveal", "focus pull between textures", "static insert with bokeh background"],
};

const ENERGY_TO_CAMERA: Record<string, string> = {
  high: "Fast dynamic cuts, whip pans, energetic handheld, rapid dolly movements",
  medium: "Balanced tracking shots, moderate pacing, smooth transitions",
  low: "Slow contemplative drifts, static held compositions, long takes",
};

const LIGHTING_BY_MOOD: Record<string, string> = {
  opening: "Golden hour warm key light, long shadows, atmospheric haze",
  verse: "Soft diffused natural light, subtle fill, gentle gradients",
  chorus: "High contrast dramatic lighting, sharp shadows, vibrant colors",
  bridge: "Cool toned ambient lighting, neon practicals, moody palette",
  outro: "Fading twilight, desaturated palette, soft backlight",
};

function buildStyleConsistentPrompt(
  basePrompt: string,
  styleBible: Record<string, any> | null,
  characterBible: any[] | Record<string, any> | null,
  stylePreset: string,
  shotIdx: number,
  totalShots: number,
  shotMeta?: { shot_type?: string; section?: string; energy_level?: string; camera_movement?: string }
): string {
  const parts: string[] = [];

  if (styleBible) {
    if (styleBible.visual_rules) parts.push(`[STYLE] ${styleBible.visual_rules}`);
    if (styleBible.palette) {
      const palette = Array.isArray(styleBible.palette) ? styleBible.palette.join(", ") : styleBible.palette;
      parts.push(`[PALETTE] ${palette}`);
    }
    if (styleBible.texture_guidelines) parts.push(`[TEXTURE] ${styleBible.texture_guidelines}`);
    if (styleBible.mood) parts.push(`[MOOD] ${styleBible.mood}`);
  }

  const shotType = shotMeta?.shot_type || "medium";
  const cameraOptions = CAMERA_BY_SHOT_TYPE[shotType] || CAMERA_BY_SHOT_TYPE.medium;
  const selectedCamera = shotMeta?.camera_movement || cameraOptions[shotIdx % cameraOptions.length];
  parts.push(`[FRAMING] ${shotType} shot, ${selectedCamera}`);
  parts.push(`[CAMERA ENERGY] ${ENERGY_TO_CAMERA[shotMeta?.energy_level || "medium"] || ENERGY_TO_CAMERA.medium}`);

  const section = shotMeta?.section || "verse";
  parts.push(`[LIGHTING] ${styleBible?.lighting || LIGHTING_BY_MOOD[section] || LIGHTING_BY_MOOD.verse}`);

  if (characterBible) {
    const chars = Array.isArray(characterBible) ? characterBible : Object.entries(characterBible).map(([name, desc]) => ({ name, description: typeof desc === "string" ? desc : JSON.stringify(desc) }));
    if (chars.length > 0) {
      const charDescs = chars.map((c: any) => `${c.name}: ${c.visual_description || c.description || JSON.stringify(c)}`).join("; ");
      parts.push(`[CHARACTERS] ${charDescs}`);
    }
  }

  const position = shotIdx / totalShots;
  if (position < 0.08) parts.push("[NARRATIVE] Opening hook");
  else if (position > 0.83 && position < 0.95) parts.push("[NARRATIVE] Climax");
  else if (position >= 0.95) parts.push("[NARRATIVE] Final image");

  // Inject corpus production directives if available
  if (styleBible?.corpus_production_directives) {
    parts.push(`[CORPUS DIRECTIVES] ${styleBible.corpus_production_directives.slice(0, 500)}`);
  }
  if (styleBible?.corpus_characters) {
    const corpusCharDescs = (styleBible.corpus_characters as any[])
      .map((c: any) => `${c.name}: ${c.visual_description || c.role || JSON.stringify(c)}`)
      .join("; ");
    if (corpusCharDescs && !characterBible) {
      parts.push(`[CORPUS CHARACTERS] ${corpusCharDescs}`);
    }
  }

  parts.push(`[CONSISTENCY] Style: ${stylePreset}. Maintain visual coherence.`);
  return parts.join(". ") + ".\n\n" + basePrompt;
}

// ─── Base64 to Storage Upload ───────────────────────────────────────────────

async function uploadBase64ToStorage(
  supabase: any,
  projectId: string,
  shotId: string,
  dataUri: string
): Promise<string> {
  // Parse data URI: data:image/png;base64,iVBOR...
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid data URI format");

  const mimeType = match[1];
  const base64Data = match[2];
  const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "png";
  const fileName = `${projectId}/${shotId}.${ext}`;

  // Decode base64 to Uint8Array
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const { error } = await supabase.storage
    .from("shot-outputs")
    .upload(fileName, bytes, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from("shot-outputs").getPublicUrl(fileName);
  return urlData.publicUrl;
}

// ─── Main Handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { project_id, batch_size: requestedBatch = 10, action } = await req.json();
    const MAX_BATCH = 5; // Deno edge function timeout protection
    const batch_size = Math.min(requestedBatch, MAX_BATCH);
    if (!project_id) throw new Error("project_id required");

    const { data: project } = await supabase.from("projects").select("*").eq("id", project_id).single();
    if (!project) throw new Error("Project not found");

    const { data: plan } = await supabase
      .from("plans")
      .select("style_bible_json, character_bible_json, shotlist_json")
      .eq("project_id", project_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    let styleBible = (plan?.style_bible_json as Record<string, any>) || null;
    const characterBible = plan?.character_bible_json || null;
    const shotlistJson = (plan?.shotlist_json as any[]) || [];

    // ── Corpus enrichment: inject extracted production directives into style bible ──
    const { data: docs } = await supabase
      .from("source_documents")
      .select("id, document_role")
      .eq("project_id", project_id)
      .neq("status", "parsing_failed");
    const docIds = (docs || []).map((d: any) => d.id);

    if (docIds.length > 0) {
      const { data: prodEntities } = await supabase
        .from("source_document_entities")
        .select("entity_type, entity_key, entity_value")
        .in("document_id", docIds)
        .in("entity_type", ["camera_direction", "lighting", "color_palette", "sound_design", "sensory_note", "production_directive", "visual_reference", "cinematic_reference"])
        .gte("extraction_confidence", 0.6)
        .in("status", ["confirmed", "proposed"])
        .limit(30);

      if (prodEntities?.length) {
        // Merge corpus directives into style bible
        if (!styleBible) styleBible = {};
        const corpusDirectives = prodEntities.map((e: any) => `[${e.entity_type}] ${e.entity_key}: ${JSON.stringify(e.entity_value)}`).join("\n");
        styleBible.corpus_production_directives = corpusDirectives;
        console.log(`[generate-shots] Injected ${prodEntities.length} corpus production directives`);
      }

      // Also load corpus characters to enrich character bible
      const { data: corpusChars } = await supabase
        .from("source_document_entities")
        .select("entity_key, entity_value")
        .in("document_id", docIds)
        .eq("entity_type", "character")
        .gte("extraction_confidence", 0.7)
        .in("status", ["confirmed", "proposed"])
        .limit(20);

      if (corpusChars?.length && !characterBible) {
        // No plan character bible exists — use corpus characters
        styleBible.corpus_characters = corpusChars.map((c: any) => ({
          name: c.entity_key,
          ...c.entity_value as Record<string, unknown>,
        }));
        console.log(`[generate-shots] Injected ${corpusChars.length} corpus characters as fallback`);
      }
    }

    const providerChain = buildProviderChain(project.provider_default || undefined);
    if (providerChain.length === 0) {
      throw new Error("No generation provider configured. Add at least one valid provider API key.");
    }

    console.log(`[generate-shots] Provider chain: ${providerChain.map(p => `${p.name}(${p.outputType}/${p.modelId})`).join(" → ")}`);

    const { data: pendingShots } = await supabase
      .from("shots")
      .select("*")
      .eq("project_id", project_id)
      .in("status", ["pending"])
      .order("idx")
      .limit(batch_size);

    const { count: totalShotsCount } = await supabase
      .from("shots")
      .select("*", { count: "exact", head: true })
      .eq("project_id", project_id);

    if (!pendingShots || pendingShots.length === 0) {
      const { data: allShots } = await supabase.from("shots").select("status").eq("project_id", project_id);
      const completed = allShots?.filter(s => s.status === "completed").length || 0;
      const allDone = allShots?.every(s => s.status === "completed" || s.status === "failed");
      if (allDone && completed > 0) {
        await supabase.from("projects").update({ status: "stitching" }).eq("id", project_id);
        return jsonResponse({ success: true, message: "All shots done, moving to stitch", completed });
      }
      return jsonResponse({ success: true, message: "No pending shots", provider_chain: providerChain.map(p => p.name) });
    }

    const results: any[] = [];
    let creditsUsed = 0;

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: project.user_id, _role: "admin" });

    const avgCreditPerShot = 3; // conservative estimate
    const totalEstimatedCredits = pendingShots.length * avgCreditPerShot;
    if (!isAdmin) {
      const { data: wallet } = await supabase.from("credit_wallets").select("balance").eq("id", project.user_id).single();
      if (!wallet || wallet.balance < totalEstimatedCredits) {
        await supabase.from("projects").update({ status: "failed" }).eq("id", project_id);
        return jsonResponse({ success: false, error: "Insufficient credits", required: totalEstimatedCredits, available: wallet?.balance || 0 });
      }
    }

    for (const shot of pendingShots) {
      try {
        await supabase.from("shots").update({ status: "generating" }).eq("id", shot.id);

        const shotMeta = shotlistJson.find((s: any) => s.idx === shot.idx);
        const totalShots = totalShotsCount || shotlistJson.length || pendingShots.length;

        const enrichedPrompt = buildStyleConsistentPrompt(
          shot.prompt || "", styleBible, characterBible, project.style_preset || "cinematic",
          shot.idx, totalShots,
          shotMeta ? { shot_type: shotMeta.shot_type, section: shotMeta.section, energy_level: shotMeta.energy_level, camera_movement: shotMeta.camera_movement } : undefined
        );

        const { provider: usedProvider, job_id, attempts } = await generateWithFallback(
          providerChain, enrichedPrompt, shot.duration_sec || 7, project.style_preset || "cinematic", shot.seed || Math.floor(Math.random() * 999999)
        );

        await supabase.from("shots").update({ provider: usedProvider.name, provider_type: usedProvider.outputType }).eq("id", shot.id);

        const isSynchronous = usedProvider.outputType === "image" || job_id.startsWith("http") || job_id.startsWith("data:");

        if (isSynchronous) {
          const result = await usedProvider.checkStatus(job_id);
          if (result.status === "failed") throw new Error(result.error || `${usedProvider.name} failed`);
          if (result.status === "completed") {
            if (!result.url) throw new Error(`${usedProvider.name} completed without URL`);
            if (!ALLOW_PLACEHOLDER_PROVIDERS && isPlaceholderUrl(result.url)) throw new Error(`${usedProvider.name} returned placeholder`);

            // Upload base64 data URIs to storage for persistence
            let finalUrl = result.url;
            if (finalUrl.startsWith("data:")) {
              try {
                finalUrl = await uploadBase64ToStorage(supabase, project_id, shot.id, finalUrl);
                console.log(`[generate-shots] Uploaded base64 to storage: ${finalUrl}`);
              } catch (uploadErr) {
                console.warn(`[generate-shots] Storage upload failed, keeping data URI:`, uploadErr);
              }
            }

            const shotCreditCost = PROVIDER_CREDIT_COST[usedProvider.name] || 2;
            await supabase.from("shots").update({ status: "completed", output_url: finalUrl, cost_credits: shotCreditCost, error_message: null }).eq("id", shot.id);
            creditsUsed += shotCreditCost;
            results.push({ shot_id: shot.id, provider: usedProvider.name, model: usedProvider.modelId, output_type: usedProvider.outputType, status: "completed" });
            continue;
          }
        }

        // Async provider — store job reference
        await supabase.from("shots").update({ status: "generating", output_url: `job:${usedProvider.name}:${job_id}`, error_message: null }).eq("id", shot.id);
        results.push({ shot_id: shot.id, provider: usedProvider.name, model: usedProvider.modelId, output_type: usedProvider.outputType, status: "generating" });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`[generate-shots] Shot ${shot.idx} failed:`, message);
        await supabase.from("shots").update({ status: "failed", error_message: message }).eq("id", shot.id);
        results.push({ shot_id: shot.id, error: message });

        // Auto-create incident for permanent failures
        await supabase.from("incidents").insert({
          project_id,
          title: `Shot #${shot.idx} generation failed`,
          detail: `Provider chain exhausted. Error: ${message}`,
          severity: "warning",
          scope: "shot",
          scope_id: shot.id,
          status: "open",
        }).then(({ error: incErr }) => { if (incErr) console.error("Incident insert failed:", incErr); });
      }
    }

    if (creditsUsed > 0) {
      const batchRef = `${project_id}_gen_${Date.now()}`;
      await supabase.rpc("debit_credits", {
        p_user_id: project.user_id, p_amount: creditsUsed,
        p_reason: `Shot generation (${results.filter((r: any) => r.status === "completed" || r.status === "generating").length} shots)`,
        p_ref_id: batchRef, p_ref_type: "shot_generation",
      });
    }

    return jsonResponse({ success: true, results, credits_used: creditsUsed, provider_chain: providerChain.map(p => ({ name: p.name, model: p.modelId, type: p.outputType })) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[generate-shots] Fatal error:", message);
    return new Response(JSON.stringify({ error: message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
