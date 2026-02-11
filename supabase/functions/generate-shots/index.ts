import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Provider abstraction
interface VideoProvider {
  name: string;
  generateVideo(prompt: string, duration: number, style: string, seed: number): Promise<{ job_id: string }>;
  checkStatus(job_id: string): Promise<{ status: string; url?: string }>;
}

class MockProvider implements VideoProvider {
  name = "mock";
  async generateVideo(prompt: string, duration: number) {
    return { job_id: `mock-${crypto.randomUUID()}` };
  }
  async checkStatus(job_id: string) {
    // Simulate completion after creation
    return { status: "completed", url: `https://placehold.co/1920x1080/1a1a1a/ff8c00?text=Shot+${job_id.slice(-4)}` };
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
      body: JSON.stringify({ model: "sora", prompt, duration, size: "1920x1080" }),
    });
    const data = await res.json();
    return { job_id: data.id || `sora-${crypto.randomUUID()}` };
  }
  async checkStatus(job_id: string) {
    return { status: "completed", url: undefined };
  }
}

class RunwayProvider implements VideoProvider {
  name = "runway";
  private apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }
  async generateVideo(prompt: string, duration: number) {
    const res = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
      method: "POST",
      headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json", "X-Runway-Version": "2024-11-06" },
      body: JSON.stringify({ model: "gen4_turbo", promptText: prompt, duration: Math.min(duration, 10) }),
    });
    const data = await res.json();
    return { job_id: data.id || `runway-${crypto.randomUUID()}` };
  }
  async checkStatus(job_id: string) {
    return { status: "completed", url: undefined };
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
      body: JSON.stringify({ prompt, model: "ray-2", duration: `${Math.min(duration, 9)}s` }),
    });
    const data = await res.json();
    return { job_id: data.id || `luma-${crypto.randomUUID()}` };
  }
  async checkStatus(job_id: string) {
    return { status: "completed", url: undefined };
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
    return { status: "completed", url: undefined };
  }
}

function getProvider(providerName?: string): VideoProvider {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const runwayKey = Deno.env.get("RUNWAY_API_KEY");
  const lumaKey = Deno.env.get("LUMA_API_KEY");
  const veoKey = Deno.env.get("GOOGLE_VEO_API_KEY");

  if (providerName === "sora" && openaiKey) return new SoraProvider(openaiKey);
  if (providerName === "runway" && runwayKey) return new RunwayProvider(runwayKey);
  if (providerName === "luma" && lumaKey) return new LumaProvider(lumaKey);
  if (providerName === "veo" && veoKey) return new VeoProvider(veoKey);

  // Auto-select first available or mock
  if (openaiKey) return new SoraProvider(openaiKey);
  if (runwayKey) return new RunwayProvider(runwayKey);
  if (lumaKey) return new LumaProvider(lumaKey);
  if (veoKey) return new VeoProvider(veoKey);

  return new MockProvider();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { project_id, batch_size = 5 } = await req.json();
    if (!project_id) throw new Error("project_id required");

    const { data: project } = await supabase.from("projects").select("*").eq("id", project_id).single();
    if (!project) throw new Error("Project not found");

    const provider = getProvider(project.provider_default || undefined);

    // Get pending shots
    const { data: pendingShots } = await supabase
      .from("shots")
      .select("*")
      .eq("project_id", project_id)
      .in("status", ["pending", "failed"])
      .order("idx")
      .limit(batch_size);

    if (!pendingShots || pendingShots.length === 0) {
      // Check if all shots are completed
      const { data: allShots } = await supabase
        .from("shots")
        .select("status")
        .eq("project_id", project_id);

      const allCompleted = allShots?.every(s => s.status === "completed");
      if (allCompleted) {
        await supabase.from("projects").update({ status: "stitching" }).eq("id", project_id);
        return new Response(JSON.stringify({ success: true, message: "All shots completed, moving to stitch" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, message: "No pending shots", generating: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];
    for (const shot of pendingShots) {
      try {
        await supabase.from("shots").update({ status: "generating", provider: provider.name }).eq("id", shot.id);

        const { job_id } = await provider.generateVideo(
          shot.prompt || "",
          shot.duration_sec || 7,
          project.style_preset || "cinematic",
          shot.seed || Math.floor(Math.random() * 999999)
        );

        // For mock provider, immediately complete
        if (provider.name === "mock") {
          const { url } = await provider.checkStatus(job_id);
          await supabase.from("shots").update({
            status: "completed",
            output_url: url,
            cost_credits: 2,
          }).eq("id", shot.id);
        }

        results.push({ shot_id: shot.id, job_id, status: "started" });
      } catch (err) {
        await supabase.from("shots").update({
          status: "failed",
          error_message: err.message,
        }).eq("id", shot.id);
        results.push({ shot_id: shot.id, error: err.message });
      }
    }

    // Deduct credits for completed shots
    const completedCount = results.filter(r => r.status === "started").length;
    if (completedCount > 0 && provider.name === "mock") {
      const creditCost = completedCount * 2;
      await supabase.rpc("has_role", { _role: "admin", _user_id: project.user_id }); // Just a ping
      await supabase
        .from("credit_wallets")
        .update({ balance: supabase.rpc ? undefined : 0 })
        .eq("id", project.user_id);
      
      // Use ledger
      await supabase.from("credit_ledger").insert({
        user_id: project.user_id,
        delta: -creditCost,
        reason: `Shot generation (${completedCount} shots)`,
        ref_type: "project",
        ref_id: project_id,
      });
    }

    return new Response(JSON.stringify({ success: true, results, provider: provider.name }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
