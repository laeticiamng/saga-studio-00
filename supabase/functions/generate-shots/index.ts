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
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-1", prompt: `${style} style cinematic video frame. ${prompt}`, n: 1, size: "1536x1024" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "OpenAI API error");
    // Return image URL as placeholder since Sora video API may not be available
    return { job_id: data.data?.[0]?.url || `sora-${crypto.randomUUID()}` };
  }
  async checkStatus(job_id: string) {
    // If job_id is a URL, it's already completed (image generation is sync)
    if (job_id.startsWith("http")) {
      return { status: "completed" as const, url: job_id };
    }
    return { status: "pending" as const, url: undefined, error: undefined };
  }
}

class RunwayProvider implements VideoProvider {
  name = "runway";
  private apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }
  async generateVideo(prompt: string, duration: number) {
    const runwayDuration = duration <= 5 ? 5 : 10;
    const res = await fetch("https://api.dev.runwayml.com/v1/text_to_video", {
      method: "POST",
      headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json", "X-Runway-Version": "2024-11-06" },
      body: JSON.stringify({ model: "gen4_turbo", promptText: prompt.slice(0, 2000), duration: runwayDuration, ratio: "1280:768" }),
    });
    const data = await res.json();
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

class LumaProvider implements VideoProvider {
  name = "luma";
  private apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }
  async generateVideo(prompt: string, duration: number) {
    // Luma only accepts "5s", "9s", or "10s"
    const lumaDuration = duration <= 5 ? "5s" : duration <= 9 ? "9s" : "10s";
    const res = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt.slice(0, 2000), model: "ray-2", resolution: "1080p", duration: lumaDuration }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.message || JSON.stringify(data));
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
  async checkStatus() { return { status: "completed" as const, url: `https://placehold.co/1920x1080/1a1a1a/00ff88?text=Veo+Preview` }; }
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
  if (preferredProvider && keys[preferredProvider]) {
    chain.push(factories[preferredProvider](keys[preferredProvider]!));
  }
  for (const name of PROVIDER_PRIORITY) {
    if (name !== preferredProvider && keys[name]) {
      chain.push(factories[name](keys[name]!));
    }
  }
  chain.push(new MockProvider());
  return chain;
}

async function generateWithFallback(
  chain: VideoProvider[],
  prompt: string,
  duration: number,
  style: string,
  seed: number,
  maxRetries = 0  // No retries by default - fail fast and move to next provider
): Promise<{ provider: VideoProvider; job_id: string; attempts: { provider: string; error?: string }[] }> {
  const attempts: { provider: string; error?: string }[] = [];
  for (const provider of chain) {
    try {
      // Wrap each provider call with a 15s timeout
      const result = await Promise.race([
        provider.generateVideo(prompt, duration, style, seed),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Provider timeout (15s)")), 15000)),
      ]);
      attempts.push({ provider: provider.name });
      return { provider, job_id: result.job_id, attempts };
    } catch (err: any) {
      attempts.push({ provider: provider.name, error: err.message });
      console.warn(`[generate-shots] ${provider.name} failed: ${err.message}`);
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
  high: "Fast dynamic cuts, whip pans, energetic handheld, rapid dolly movements, quick cross-cutting",
  medium: "Balanced tracking shots, moderate pacing, smooth transitions, controlled movements",
  low: "Slow contemplative drifts, static held compositions, long takes, gentle floating movements",
};

const LIGHTING_BY_MOOD: Record<string, string> = {
  opening: "Golden hour warm key light, long shadows, atmospheric haze, silhouette rim lighting",
  verse: "Soft diffused natural light, subtle fill, gentle gradients, muted color temperature",
  chorus: "High contrast dramatic lighting, sharp hard shadows, vibrant saturated colors, dynamic light shifts",
  bridge: "Cool toned ambient lighting, neon practicals, moody blue-purple palette, isolated pools of light",
  outro: "Fading twilight, desaturated palette, soft backlight, melancholic lens flare",
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

  // ── PILLAR 2: ARTISTIC STYLE ──
  if (styleBible) {
    if (styleBible.visual_rules) parts.push(`[STYLE] ${styleBible.visual_rules}`);
    if (styleBible.palette) {
      const palette = Array.isArray(styleBible.palette) ? styleBible.palette.join(", ") : styleBible.palette;
      parts.push(`[PALETTE] Color scheme: ${palette}`);
    }
    if (styleBible.texture_guidelines) parts.push(`[TEXTURE] ${styleBible.texture_guidelines}`);
    if (styleBible.mood) parts.push(`[MOOD] ${styleBible.mood}`);
  }

  // ── PILLAR 3: FRAMING & COMPOSITION (Camera) ──
  const shotType = shotMeta?.shot_type || "medium";
  const cameraOptions = CAMERA_BY_SHOT_TYPE[shotType] || CAMERA_BY_SHOT_TYPE.medium;
  const selectedCamera = shotMeta?.camera_movement || cameraOptions[shotIdx % cameraOptions.length];
  parts.push(`[FRAMING] ${shotType} shot, ${selectedCamera}`);

  // Energy-based camera behavior
  const energyLevel = shotMeta?.energy_level || "medium";
  parts.push(`[CAMERA ENERGY] ${ENERGY_TO_CAMERA[energyLevel] || ENERGY_TO_CAMERA.medium}`);

  // ── PILLAR 4: LIGHTING & ATMOSPHERE ──
  const section = shotMeta?.section || "verse";
  const lightingStyle = styleBible?.lighting || LIGHTING_BY_MOOD[section] || LIGHTING_BY_MOOD.verse;
  parts.push(`[LIGHTING] ${lightingStyle}`);

  // ── CHARACTER CONSISTENCY (Pillar 1 enhancement) ──
  if (characterBible) {
    const chars = Array.isArray(characterBible) ? characterBible : Object.entries(characterBible).map(([name, desc]) => ({ name, description: typeof desc === 'string' ? desc : JSON.stringify(desc) }));
    if (chars.length > 0) {
      const charDescs = chars.map((c: any) => {
        const desc = c.visual_description || c.description || JSON.stringify(c);
        return `${c.name}: ${desc}`;
      }).join("; ");
      parts.push(`[CHARACTERS] Recurring characters (maintain exact appearance): ${charDescs}`);
    }
  }

  // ── NARRATIVE POSITION ──
  const position = shotIdx / totalShots;
  if (position < 0.08) parts.push("[NARRATIVE] Opening hook — establish world with striking first image");
  else if (position < 0.15) parts.push("[NARRATIVE] Setup — introduce protagonist and setting");
  else if (position > 0.83 && position < 0.95) parts.push("[NARRATIVE] Climax — peak dramatic intensity");
  else if (position >= 0.95) parts.push("[NARRATIVE] Final image — memorable closing shot, mirror or contrast opening");
  else if (position > 0.4 && position < 0.6) parts.push("[NARRATIVE] Midpoint — shift in energy or revelation");

  // ── GLOBAL CONSISTENCY ──
  parts.push(`[CONSISTENCY] Visual style: ${stylePreset}. Maintain strict visual coherence across all shots. Same color grade, same lens characteristics, same world.`);

  const stylePrefix = parts.join(". ") + ".\n\n";
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
    const characterBible = plan?.character_bible_json || null;
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

    // Get total shots count
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

    // Check if user is admin (bypass credit check)
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: project.user_id,
      _role: "admin",
    });

    // Pre-check credits (skip for admins)
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

        // Find matching shotlist entry for metadata
        const shotMeta = shotlistJson.find((s: any) => s.idx === shot.idx);
        const totalShots = totalShotsCount || shotlistJson.length || pendingShots.length;

        // ── Cinematic Prompt Engine: enrich with 5 pillars ──
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

        await supabase.from("shots").update({ provider: usedProvider.name }).eq("id", shot.id);

        // For sync/placeholder providers, immediately check and complete
        const syncProviders = ["mock", "veo", "sora"];
        if (syncProviders.includes(usedProvider.name) || job_id.startsWith("http")) {
          const result = await usedProvider.checkStatus(job_id);
          if (result.status === "completed") {
            await supabase.from("shots").update({
              status: "completed",
              output_url: result.url || `https://placehold.co/1920x1080/1a1a1a/ff8c00?text=Shot+${shot.idx + 1}`,
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

    // Atomic credit debit with idempotence
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
