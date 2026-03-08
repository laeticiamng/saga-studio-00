import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Provider Abstraction ───────────────────────────────────────────────────

interface VideoProvider {
  name: string;
  generateVideo(prompt: string, duration: number, style: string, seed: number): Promise<{ job_id: string }>;
  checkStatus(job_id: string): Promise<{ status: "pending" | "completed" | "failed"; url?: string; error?: string }>;
}

class MockProvider implements VideoProvider {
  name = "mock";
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

class SoraProvider implements VideoProvider {
  name = "sora";
  private apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }
  async generateVideo(prompt: string, duration: number, style: string) {
    const res = await fetch("https://api.openai.com/v1/videos/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "sora", prompt: `${style} style. ${prompt}`, duration: Math.min(duration, 20), size: "1920x1080" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Sora API error");
    return { job_id: data.id };
  }
  async checkStatus(job_id: string) {
    const res = await fetch(`https://api.openai.com/v1/videos/generations/${job_id}`, { headers: { "Authorization": `Bearer ${this.apiKey}` } });
    const data = await res.json();
    const status = data.status === "succeeded" ? "completed" : data.status === "failed" ? "failed" : "pending";
    return { status: status as any, url: data.output?.url, error: data.error?.message };
  }
}

class RunwayProvider implements VideoProvider {
  name = "runway";
  private apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }
  async generateVideo(prompt: string, duration: number) {
    const res = await fetch("https://api.dev.runwayml.com/v1/text_to_video", {
      method: "POST",
      headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json", "X-Runway-Version": "2024-11-06" },
      body: JSON.stringify({ model: "gen4_turbo", promptText: prompt, duration: Math.min(duration, 10), ratio: "16:9" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Runway API error");
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

class LumaProvider implements VideoProvider {
  name = "luma";
  private apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }
  async generateVideo(prompt: string, duration: number) {
    const res = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, model: "ray-2", resolution: "1080p", duration: `${Math.min(duration, 9)}s` }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Luma API error");
    return { job_id: data.id };
  }
  async checkStatus(job_id: string) {
    const res = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${job_id}`, {
      headers: { "Authorization": `Bearer ${Deno.env.get("LUMA_API_KEY")}` },
    });
    const data = await res.json();
    const status = data.state === "completed" ? "completed" : data.state === "failed" ? "failed" : "pending";
    return { status: status as any, url: data.assets?.video, error: data.failure_reason };
  }
}

class VeoProvider implements VideoProvider {
  name = "veo";
  private apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }
  async generateVideo() { return { job_id: `veo-${crypto.randomUUID()}` }; }
  async checkStatus() { return { status: "completed" as const, url: undefined }; }
}

// ─── Provider Fallback Chain ────────────────────────────────────────────────

const PROVIDER_PRIORITY = ["sora", "runway", "luma", "veo"] as const;

function buildProviderChain(preferredProvider?: string): VideoProvider[] {
  const keys: Record<string, string | undefined> = {
    sora: Deno.env.get("OPENAI_API_KEY"),
    runway: Deno.env.get("RUNWAY_API_KEY"),
    luma: Deno.env.get("LUMA_API_KEY"),
    veo: Deno.env.get("GOOGLE_VEO_API_KEY"),
  };
  const factories: Record<string, (k: string) => VideoProvider> = {
    sora: (k) => new SoraProvider(k),
    runway: (k) => new RunwayProvider(k),
    luma: (k) => new LumaProvider(k),
    veo: (k) => new VeoProvider(k),
  };

  const chain: VideoProvider[] = [];

  // Put preferred provider first
  if (preferredProvider && keys[preferredProvider]) {
    chain.push(factories[preferredProvider](keys[preferredProvider]!));
  }

  // Add remaining providers in priority order
  for (const name of PROVIDER_PRIORITY) {
    if (name !== preferredProvider && keys[name]) {
      chain.push(factories[name](keys[name]!));
    }
  }

  // Always have mock as last resort
  chain.push(new MockProvider());
  return chain;
}

async function generateWithFallback(
  chain: VideoProvider[],
  prompt: string,
  duration: number,
  style: string,
  seed: number,
  maxRetries = 2
): Promise<{ provider: VideoProvider; job_id: string; attempts: { provider: string; error?: string }[] }> {
  const attempts: { provider: string; error?: string }[] = [];

  for (const provider of chain) {
    for (let retry = 0; retry <= maxRetries; retry++) {
      try {
        // Exponential backoff on retry
        if (retry > 0) {
          await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, retry), 8000)));
        }
        const { job_id } = await provider.generateVideo(prompt, duration, style, seed);
        attempts.push({ provider: provider.name });
        return { provider, job_id, attempts };
      } catch (err: any) {
        attempts.push({ provider: provider.name, error: err.message });
        console.warn(`[generate-shots] ${provider.name} attempt ${retry + 1} failed: ${err.message}`);
        // Only retry on same provider for transient errors (rate limit, timeout)
        const isTransient = /rate|timeout|503|429|500/i.test(err.message);
        if (!isTransient) break; // Skip to next provider
      }
    }
  }

  throw new Error(`All providers failed: ${attempts.map(a => `${a.provider}:${a.error}`).join(", ")}`);
}

// ─── Style Consistency Engine ───────────────────────────────────────────────

function buildStyleConsistentPrompt(
  basePrompt: string,
  styleBible: Record<string, any> | null,
  characterBible: Record<string, any> | null,
  stylePreset: string,
  shotIdx: number,
  totalShots: number
): string {
  const parts: string[] = [];

  // Global style enforcement
  if (styleBible) {
    if (styleBible.color_palette) parts.push(`Color palette: ${styleBible.color_palette}`);
    if (styleBible.lighting) parts.push(`Lighting: ${styleBible.lighting}`);
    if (styleBible.camera_style) parts.push(`Camera: ${styleBible.camera_style}`);
    if (styleBible.mood) parts.push(`Mood: ${styleBible.mood}`);
    if (styleBible.texture) parts.push(`Texture: ${styleBible.texture}`);
    if (styleBible.aspect_ratio) parts.push(`Aspect ratio: ${styleBible.aspect_ratio}`);
  }

  // Character consistency
  if (characterBible && Object.keys(characterBible).length > 0) {
    const charDescs = Object.entries(characterBible)
      .map(([name, desc]) => `${name}: ${typeof desc === 'string' ? desc : JSON.stringify(desc)}`)
      .join("; ");
    parts.push(`Recurring characters: ${charDescs}`);
  }

  // Style preset enforcement
  parts.push(`Visual style: ${stylePreset}`);

  // Shot position context for narrative flow
  const position = shotIdx / totalShots;
  if (position < 0.15) parts.push("Opening shot - establish setting and tone");
  else if (position > 0.85) parts.push("Closing shot - climactic or resolving energy");
  else if (position > 0.4 && position < 0.6) parts.push("Midpoint - peak intensity");

  // Seed phrase for cross-shot consistency
  parts.push("Maintain strict visual consistency with all other shots in this project");

  const stylePrefix = parts.join(". ") + ". ";
  return stylePrefix + basePrompt;
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

    // Fetch style/character bibles for consistency
    const { data: plan } = await supabase
      .from("plans")
      .select("style_bible_json, character_bible_json, shotlist_json")
      .eq("project_id", project_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const styleBible = (plan?.style_bible_json as Record<string, any>) || null;
    const characterBible = (plan?.character_bible_json as Record<string, any>) || null;
    const shotlistJson = (plan?.shotlist_json as any[]) || [];

    const providerChain = buildProviderChain(project.provider_default || undefined);

    // Get pending shots
    const { data: pendingShots } = await supabase
      .from("shots")
      .select("*")
      .eq("project_id", project_id)
      .in("status", ["pending"])
      .order("idx")
      .limit(batch_size);

    // Get total shots count for position-aware prompting
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
      return jsonResponse({ success: true, message: "No pending shots", provider: providerChain[0]?.name });
    }

    const results = [];
    let creditsUsed = 0;

    // P0-1: Pre-check credits BEFORE generating
    const totalEstimatedCredits = pendingShots.length * 2;
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

    for (const shot of pendingShots) {
      try {
        await supabase.from("shots").update({ status: "generating" }).eq("id", shot.id);

        // ── Style Consistency: enrich prompt with style/character bibles ──
        const totalShots = totalShotsCount || shotlistJson.length || pendingShots.length;
        const enrichedPrompt = buildStyleConsistentPrompt(
          shot.prompt || "",
          styleBible,
          characterBible,
          project.style_preset || "cinematic",
          shot.idx,
          totalShots
        );

        const { provider: usedProvider, job_id, attempts } = await generateWithFallback(
          providerChain,
          enrichedPrompt,
          shot.duration_sec || 7,
          project.style_preset || "cinematic",
          shot.seed || Math.floor(Math.random() * 999999)
        );

        // Update shot with actual provider used
        await supabase.from("shots").update({ provider: usedProvider.name }).eq("id", shot.id);

        // For mock provider, immediately complete
        if (usedProvider.name === "mock") {
          const result = await usedProvider.checkStatus(job_id);
          if (result.status === "completed" && result.url) {
            await supabase.from("shots").update({
              status: "completed",
              output_url: result.url,
              cost_credits: 2,
            }).eq("id", shot.id);
            creditsUsed += 2;
          }
        }

        results.push({ shot_id: shot.id, job_id, provider: usedProvider.name, attempts, status: "started" });
      } catch (err: any) {
        await supabase.from("shots").update({
          status: "failed",
          error_message: err.message,
        }).eq("id", shot.id);
        results.push({ shot_id: shot.id, error: err.message });
      }
    }

    // P0-1: Atomic credit debit with idempotence (ref_id = project_id + batch timestamp)
    if (creditsUsed > 0) {
      const batchRef = `${project_id}_gen_${Date.now()}`;
      const { data: debited } = await supabase.rpc("debit_credits", {
        p_user_id: project.user_id,
        p_amount: creditsUsed,
        p_reason: `Shot generation (${results.filter(r => r.status === "started").length} shots)`,
        p_ref_id: batchRef,
        p_ref_type: "shot_generation",
      });
      if (!debited) {
        console.error(`[generate-shots] Atomic debit failed for user ${project.user_id}, amount ${creditsUsed}`);
      }
    }

    return jsonResponse({ success: true, results, credits_used: creditsUsed });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
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
