import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Provider Abstraction ───────────────────────────────────────────────────

interface VideoProvider {
  name: string;
  /** "video" = real video file, "image" = still image (e.g. DALL-E) */
  outputType: "video" | "image";
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
  async generateVideo() {
    return { job_id: `mock-${crypto.randomUUID()}` };
  }
  async checkStatus(job_id: string) {
    return {
      status: "completed" as const,
      url: `https://placehold.co/1920x1080/1a1a1a/ff8c00?text=Shot+${job_id.slice(-4)}`,
    };
  }
}

/**
 * OpenAI Image Provider (DALL-E 3)
 * Generates still frames, NOT video. Named clearly to avoid confusion.
 * Output is an image URL that FFmpeg will convert to a video segment.
 */
class OpenAIImageProvider implements VideoProvider {
  name = "openai_image";
  outputType = "image" as const;
  private apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }
  async generateVideo(prompt: string, duration: number, style: string) {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: `${style} style cinematic video frame, film still. ${prompt}`.slice(0, 4000),
        n: 1,
        size: "1792x1024",
        response_format: "url",
      }),
    });
    const data = await res.json();
    console.log("[openai_image] response status:", res.status, "has url:", !!data.data?.[0]?.url);
    if (!res.ok) throw new Error(data.error?.message || "OpenAI API error");
    const url = data.data?.[0]?.url;
    if (!url) throw new Error("OpenAI returned no image URL");
    return { job_id: url };
  }
  async checkStatus(job_id: string) {
    if (job_id.startsWith("http")) {
      return { status: "completed" as const, url: job_id };
    }
    return { status: "failed" as const, url: undefined, error: "Invalid OpenAI image reference" };
  }
}

class RunwayProvider implements VideoProvider {
  name = "runway";
  outputType = "video" as const;
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
    console.log("[runway] text_to_video response:", res.status, JSON.stringify(data));
    if (!res.ok) throw new Error(data.error || data.message || JSON.stringify(data));
    return { job_id: data.id };
  }
  async checkStatus(job_id: string) {
    const res = await fetch(`https://api.dev.runwayml.com/v1/tasks/${job_id}`, {
      headers: {
        "Authorization": `Bearer ${Deno.env.get("RUNWAY_API_KEY")}`,
        "X-Runway-Version": "2024-11-06",
      },
    });
    const data = await res.json();
    console.log("[runway] status response:", JSON.stringify(data));
    const status = data.status === "SUCCEEDED" ? "completed" : data.status === "FAILED" ? "failed" : "pending";
    return { status: status as any, url: data.output?.[0], error: data.failure };
  }
}

class LumaProvider implements VideoProvider {
  name = "luma";
  outputType = "video" as const;
  private apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }
  async generateVideo(prompt: string, duration: number) {
    const lumaDuration = duration <= 5 ? "5s" : duration <= 9 ? "9s" : "10s";
    const res = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        prompt: prompt.slice(0, 2000),
        model: "ray-2",
        resolution: "720p",
        duration: lumaDuration,
        generation_type: "video",
      }),
    });
    const data = await res.json();
    console.log("[luma] create response:", JSON.stringify(data));
    if (!res.ok) throw new Error(data.detail || data.message || JSON.stringify(data));
    return { job_id: data.id };
  }
  async checkStatus(job_id: string) {
    const res = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${job_id}`, {
      headers: {
        "Authorization": `Bearer ${Deno.env.get("LUMA_API_KEY")}`,
        "Accept": "application/json",
      },
    });
    const data = await res.json();
    console.log("[luma] status response:", JSON.stringify(data));
    const status = data.state === "completed" ? "completed" : data.state === "failed" ? "failed" : "pending";
    return { status: status as any, url: data.assets?.video, error: data.failure_reason };
  }
}

// ─── Provider Fallback Chain ────────────────────────────────────────────────

// Priority: real video providers first, then image fallback
const PROVIDER_PRIORITY = ["runway", "luma", "openai_image"] as const;

function normalizeProviderName(provider?: string | null): string | undefined {
  if (!provider) return undefined;
  if (provider === "sora2" || provider === "sora" || provider === "openai") return "openai_image";
  if (provider === "google_veo") return undefined; // Not supported
  return provider;
}

function buildProviderChain(preferredProvider?: string): VideoProvider[] {
  const keys: Record<string, string | undefined> = {
    openai_image: Deno.env.get("OPENAI_API_KEY"),
    runway: Deno.env.get("RUNWAY_API_KEY"),
    luma: Deno.env.get("LUMA_API_KEY"),
  };
  const factories: Record<string, (k: string) => VideoProvider> = {
    openai_image: (k) => new OpenAIImageProvider(k),
    runway: (k) => new RunwayProvider(k),
    luma: (k) => new LumaProvider(k),
  };

  const chain: VideoProvider[] = [];
  const seen = new Set<string>();

  const addProvider = (name?: string) => {
    if (!name || seen.has(name)) return;
    if (name === "mock") {
      if (ALLOW_PLACEHOLDER_PROVIDERS) {
        chain.push(new MockProvider());
        seen.add(name);
      }
      return;
    }
    const key = keys[name];
    if (!key) return;
    chain.push(factories[name](key));
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

  const energyLevel = shotMeta?.energy_level || "medium";
  parts.push(`[CAMERA ENERGY] ${ENERGY_TO_CAMERA[energyLevel] || ENERGY_TO_CAMERA.medium}`);

  const section = shotMeta?.section || "verse";
  const lightingStyle = styleBible?.lighting || LIGHTING_BY_MOOD[section] || LIGHTING_BY_MOOD.verse;
  parts.push(`[LIGHTING] ${lightingStyle}`);

  if (characterBible) {
    const chars = Array.isArray(characterBible) ? characterBible : Object.entries(characterBible).map(([name, desc]) => ({ name, description: typeof desc === 'string' ? desc : JSON.stringify(desc) }));
    if (chars.length > 0) {
      const charDescs = chars.map((c: any) => {
        const desc = c.visual_description || c.description || JSON.stringify(c);
        return `${c.name}: ${desc}`;
      }).join("; ");
      parts.push(`[CHARACTERS] ${charDescs}`);
    }
  }

  const position = shotIdx / totalShots;
  if (position < 0.08) parts.push("[NARRATIVE] Opening hook");
  else if (position > 0.83 && position < 0.95) parts.push("[NARRATIVE] Climax");
  else if (position >= 0.95) parts.push("[NARRATIVE] Final image");

  parts.push(`[CONSISTENCY] Style: ${stylePreset}. Maintain visual coherence.`);

  return parts.join(". ") + ".\n\n" + basePrompt;
}

// ─── Main Handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { project_id, batch_size = 10 } = await req.json();
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

    const styleBible = (plan?.style_bible_json as Record<string, any>) || null;
    const characterBible = plan?.character_bible_json || null;
    const shotlistJson = (plan?.shotlist_json as any[]) || [];

    const providerChain = buildProviderChain(project.provider_default || undefined);
    if (providerChain.length === 0) {
      throw new Error("No generation provider configured. Add at least one valid provider API key.");
    }

    console.log(`[generate-shots] Provider chain: ${providerChain.map(p => `${p.name}(${p.outputType})`).join(" → ")}`);

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

    const results = [];
    let creditsUsed = 0;

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: project.user_id,
      _role: "admin",
    });

    const totalEstimatedCredits = pendingShots.length * 2;
    if (!isAdmin) {
      const { data: wallet } = await supabase
        .from("credit_wallets")
        .select("balance")
        .eq("id", project.user_id)
        .single();

      if (!wallet || wallet.balance < totalEstimatedCredits) {
        await supabase.from("projects").update({ status: "failed" }).eq("id", project_id);
        return jsonResponse({
          success: false,
          error: "Insufficient credits",
          required: totalEstimatedCredits,
          available: wallet?.balance || 0,
        });
      }
    }

    for (const shot of pendingShots) {
      try {
        await supabase.from("shots").update({ status: "generating" }).eq("id", shot.id);

        const shotMeta = shotlistJson.find((s: any) => s.idx === shot.idx);
        const totalShots = totalShotsCount || shotlistJson.length || pendingShots.length;

        const enrichedPrompt = buildStyleConsistentPrompt(
          shot.prompt || "",
          styleBible,
          characterBible,
          project.style_preset || "cinematic",
          shot.idx,
          totalShots,
          shotMeta ? {
            shot_type: shotMeta.shot_type,
            section: shotMeta.section,
            energy_level: shotMeta.energy_level,
            camera_movement: shotMeta.camera_movement,
          } : undefined
        );

        const { provider: usedProvider, job_id, attempts } = await generateWithFallback(
          providerChain,
          enrichedPrompt,
          shot.duration_sec || 7,
          project.style_preset || "cinematic",
          shot.seed || Math.floor(Math.random() * 999999)
        );

        // Store both provider name and output type
        await supabase.from("shots").update({
          provider: usedProvider.name,
          provider_type: usedProvider.outputType,
        }).eq("id", shot.id);

        const isSynchronousProvider = usedProvider.name === "openai_image" || job_id.startsWith("http");

        if (isSynchronousProvider) {
          const result = await usedProvider.checkStatus(job_id);

          if (result.status === "failed") {
            throw new Error(result.error || `${usedProvider.name} generation failed`);
          }

          if (result.status === "completed") {
            if (!result.url) {
              throw new Error(`${usedProvider.name} completed without output URL`);
            }
            if (!ALLOW_PLACEHOLDER_PROVIDERS && isPlaceholderUrl(result.url)) {
              throw new Error(`${usedProvider.name} returned placeholder media.`);
            }

            await supabase.from("shots").update({
              status: "completed",
              output_url: result.url,
              cost_credits: 2,
              error_message: null,
            }).eq("id", shot.id);
            creditsUsed += 2;
            results.push({ shot_id: shot.id, provider: usedProvider.name, output_type: usedProvider.outputType, status: "completed" });
            continue;
          }
        }

        // Async provider (Runway, Luma) — store job reference
        await supabase.from("shots").update({
          status: "generating",
          output_url: `job:${usedProvider.name}:${job_id}`,
          error_message: null,
        }).eq("id", shot.id);

        results.push({ shot_id: shot.id, provider: usedProvider.name, output_type: usedProvider.outputType, status: "generating" });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`[generate-shots] Shot ${shot.idx} failed:`, message);
        await supabase.from("shots").update({
          status: "failed",
          error_message: message,
        }).eq("id", shot.id);
        results.push({ shot_id: shot.id, error: message });
      }
    }

    if (creditsUsed > 0) {
      const batchRef = `${project_id}_gen_${Date.now()}`;
      const { data: debited } = await supabase.rpc("debit_credits", {
        p_user_id: project.user_id,
        p_amount: creditsUsed,
        p_reason: `Shot generation (${results.filter((r: any) => r.status === "completed" || r.status === "generating").length} shots)`,
        p_ref_id: batchRef,
        p_ref_type: "shot_generation",
      });
      if (!debited) {
        console.error(`[generate-shots] Credit debit failed for user ${project.user_id}`);
      }
    }

    return jsonResponse({
      success: true,
      results,
      credits_used: creditsUsed,
      provider_chain: providerChain.map(p => ({ name: p.name, type: p.outputType })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[generate-shots] Fatal error:", message);
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
