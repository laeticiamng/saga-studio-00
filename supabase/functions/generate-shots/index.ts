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
  async generateVideo(prompt: string, duration: number) {
    // Simulate 1-2s generation
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

  async generateVideo(prompt: string, duration: number, style: string, seed: number) {
    const res = await fetch("https://api.openai.com/v1/videos/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sora",
        prompt: `${style} style. ${prompt}`,
        duration: Math.min(duration, 20),
        size: "1920x1080",
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Sora API error");
    return { job_id: data.id };
  }

  async checkStatus(job_id: string) {
    const res = await fetch(`https://api.openai.com/v1/videos/generations/${job_id}`, {
      headers: { "Authorization": `Bearer ${this.apiKey}` },
    });
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
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body: JSON.stringify({
        model: "gen4_turbo",
        promptText: prompt,
        duration: Math.min(duration, 10),
        ratio: "16:9",
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Runway API error");
    return { job_id: data.id };
  }

  async checkStatus(job_id: string) {
    const res = await fetch(`https://api.dev.runwayml.com/v1/tasks/${job_id}`, {
      headers: { "Authorization": `Bearer ${this.apiKey}`, "X-Runway-Version": "2024-11-06" },
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
      body: JSON.stringify({
        prompt,
        model: "ray-2",
        resolution: "1080p",
        duration: `${Math.min(duration, 9)}s`,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Luma API error");
    return { job_id: data.id };
  }

  async checkStatus(job_id: string) {
    const res = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${job_id}`, {
      headers: { "Authorization": `Bearer ${this.apiKey}` },
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

  async generateVideo(prompt: string, duration: number) {
    return { job_id: `veo-${crypto.randomUUID()}` };
  }
  async checkStatus(job_id: string) {
    return { status: "completed" as const, url: undefined };
  }
}

function getProvider(providerName?: string): VideoProvider {
  const keys: Record<string, string | undefined> = {
    sora: Deno.env.get("OPENAI_API_KEY"),
    runway: Deno.env.get("RUNWAY_API_KEY"),
    luma: Deno.env.get("LUMA_API_KEY"),
    veo: Deno.env.get("GOOGLE_VEO_API_KEY"),
  };

  const providers: Record<string, (key: string) => VideoProvider> = {
    sora: (k) => new SoraProvider(k),
    runway: (k) => new RunwayProvider(k),
    luma: (k) => new LumaProvider(k),
    veo: (k) => new VeoProvider(k),
  };

  // Try requested provider first
  if (providerName && keys[providerName]) {
    return providers[providerName](keys[providerName]!);
  }

  // Auto-select first available
  for (const [name, key] of Object.entries(keys)) {
    if (key) return providers[name](key);
  }

  return new MockProvider();
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

    const provider = getProvider(project.provider_default || undefined);

    // Get pending shots
    const { data: pendingShots } = await supabase
      .from("shots")
      .select("*")
      .eq("project_id", project_id)
      .in("status", ["pending"])
      .order("idx")
      .limit(batch_size);

    if (!pendingShots || pendingShots.length === 0) {
      // Check if all shots are completed
      const { data: allShots } = await supabase
        .from("shots")
        .select("status")
        .eq("project_id", project_id);

      const completed = allShots?.filter(s => s.status === "completed").length || 0;
      const allDone = allShots?.every(s => s.status === "completed" || s.status === "failed");

      if (allDone && completed > 0) {
        await supabase.from("projects").update({ status: "stitching" }).eq("id", project_id);
        return jsonResponse({ success: true, message: "All shots done, moving to stitch", completed });
      }

      return jsonResponse({ success: true, message: "No pending shots", provider: provider.name });
    }

    const results = [];
    let creditsUsed = 0;

    for (const shot of pendingShots) {
      try {
        // Mark as generating
        await supabase.from("shots").update({
          status: "generating",
          provider: provider.name,
        }).eq("id", shot.id);

        const { job_id } = await provider.generateVideo(
          shot.prompt || "",
          shot.duration_sec || 7,
          project.style_preset || "cinematic",
          shot.seed || Math.floor(Math.random() * 999999)
        );

        // For mock provider, immediately complete
        if (provider.name === "mock") {
          const result = await provider.checkStatus(job_id);
          if (result.status === "completed" && result.url) {
            await supabase.from("shots").update({
              status: "completed",
              output_url: result.url,
              cost_credits: 2,
            }).eq("id", shot.id);
            creditsUsed += 2;
          }
        }
        // For real providers, the shot stays in "generating" status
        // and check-shot-status will poll for completion

        results.push({ shot_id: shot.id, job_id, status: "started" });
      } catch (err: any) {
        await supabase.from("shots").update({
          status: "failed",
          error_message: err.message,
        }).eq("id", shot.id);
        results.push({ shot_id: shot.id, error: err.message });
      }
    }

    // Deduct credits
    if (creditsUsed > 0) {
      // Get current balance and deduct
      const { data: wallet } = await supabase
        .from("credit_wallets")
        .select("balance")
        .eq("id", project.user_id)
        .single();

      if (wallet) {
        await supabase
          .from("credit_wallets")
          .update({ balance: Math.max(0, wallet.balance - creditsUsed) })
          .eq("id", project.user_id);
      }

      await supabase.from("credit_ledger").insert({
        user_id: project.user_id,
        delta: -creditsUsed,
        reason: `Shot generation (${results.filter(r => r.status === "started").length} shots via ${provider.name})`,
        ref_type: "project",
        ref_id: project_id,
      });
    }

    return jsonResponse({ success: true, results, provider: provider.name, credits_used: creditsUsed });
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
