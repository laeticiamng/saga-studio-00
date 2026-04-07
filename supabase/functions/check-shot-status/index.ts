import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_RETRIES_PER_SHOT = 2;
const STALE_GENERATING_TIMEOUT_MS = 30 * 60 * 1000;

function parseJobReference(value?: string | null): { provider: string; jobId: string } | null {
  if (!value || !value.startsWith("job:")) return null;
  const [, provider, ...rest] = value.split(":");
  const jobId = rest.join(":");
  if (!provider || !jobId) return null;
  return { provider, jobId };
}

function isPlaceholderUrl(url?: string | null): boolean {
  if (!url) return true;
  return url.includes("placehold.co") || url.includes("placeholder") || url.startsWith("data:");
}

// ── Provider Status Checkers ────────────────────────────────────────────────

async function checkRunwayStatus(jobId: string): Promise<{ status: "pending" | "completed" | "failed"; url?: string; error?: string }> {
  const apiKey = Deno.env.get("RUNWAY_API_KEY");
  if (!apiKey) return { status: "failed", error: "RUNWAY_API_KEY is missing" };
  const res = await fetch(`https://api.dev.runwayml.com/v1/tasks/${jobId}`, {
    headers: { "Authorization": `Bearer ${apiKey}`, "X-Runway-Version": "2024-11-06" },
  });
  const data = await res.json();
  if (!res.ok) return { status: "failed", error: data?.error || data?.message || JSON.stringify(data) };
  if (data.status === "SUCCEEDED") return { status: "completed", url: data.output?.[0] };
  if (data.status === "FAILED") return { status: "failed", error: data.failure || "Runway task failed" };
  return { status: "pending" };
}

async function checkLumaStatus(jobId: string): Promise<{ status: "pending" | "completed" | "failed"; url?: string; error?: string }> {
  const apiKey = Deno.env.get("LUMA_API_KEY");
  if (!apiKey) return { status: "failed", error: "LUMA_API_KEY is missing" };
  const res = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${jobId}`, {
    headers: { "Authorization": `Bearer ${apiKey}` },
  });
  const data = await res.json();
  if (!res.ok) return { status: "failed", error: data?.detail || data?.message || JSON.stringify(data) };
  if (data.state === "completed") return { status: "completed", url: data.assets?.video || data.assets?.image };
  if (data.state === "failed") return { status: "failed", error: data.failure_reason || "Luma task failed" };
  return { status: "pending" };
}

async function checkVeoStatus(jobId: string): Promise<{ status: "pending" | "completed" | "failed"; url?: string; error?: string }> {
  const apiKey = Deno.env.get("GOOGLE_VEO_API_KEY");
  if (!apiKey) return { status: "failed", error: "GOOGLE_VEO_API_KEY is missing" };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${jobId}?key=${apiKey}`, {
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json();
  if (!res.ok) return { status: "failed", error: data?.error?.message || JSON.stringify(data) };
  if (data.done === true) {
    const videoUri = data.response?.predictions?.[0]?.uri;
    if (videoUri) return { status: "completed", url: videoUri };
    return { status: "failed", error: "Veo completed without video output" };
  }
  if (data.error) return { status: "failed", error: data.error.message || "Veo task failed" };
  return { status: "pending" };
}

async function checkSora2Status(jobId: string): Promise<{ status: "pending" | "completed" | "failed"; url?: string; error?: string }> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return { status: "failed", error: "OPENAI_API_KEY is missing" };
  const res = await fetch(`https://api.openai.com/v1/videos/${jobId}`, {
    headers: { "Authorization": `Bearer ${apiKey}` },
  });
  const data = await res.json();
  if (!res.ok) return { status: "failed", error: data?.error?.message || JSON.stringify(data) };
  if (data.status === "completed") return { status: "completed", url: data.result?.url || data.outputs?.[0]?.url };
  if (data.status === "failed") return { status: "failed", error: data.error?.message || "Sora 2 task failed" };
  return { status: "pending" };
}

async function checkProviderStatus(provider: string, jobId: string): Promise<{ status: "pending" | "completed" | "failed"; url?: string; error?: string }> {
  // Runway family (gen4.5, act_two, aleph all use same task endpoint)
  if (provider === "runway" || provider === "runway_act_two" || provider === "runway_aleph") {
    return checkRunwayStatus(jobId);
  }
  // Luma family (ray-2, photon, reframe, modify all use same generation endpoint)
  if (provider === "luma" || provider === "luma_photon" || provider === "luma_photon_flash" || provider === "luma_reframe" || provider === "luma_modify") {
    return checkLumaStatus(jobId);
  }
  // Google Veo family (3.1, 3.1 Lite, 3.0 legacy)
  if (provider === "google_veo_31" || provider === "google_veo_31_lite" || provider === "google_veo") {
    return checkVeoStatus(jobId);
  }
  // Sora 2 (legacy)
  if (provider === "sora2") {
    return checkSora2Status(jobId);
  }
  return { status: "failed", error: `Unsupported provider for polling: ${provider}` };
}

// ─── Main Handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { project_id } = await req.json();
    if (!project_id) throw new Error("project_id required");

    const { data: shots } = await supabase.from("shots").select("*").eq("project_id", project_id).order("idx");
    if (!shots) throw new Error("No shots found");

    const retried: string[] = [];
    const failedPermanently: string[] = [];

    for (const shot of shots) {
      if (shot.status === "failed") {
        const retryCount = parseInt(shot.error_message?.match(/\[retry (\d+)\]/)?.[1] || "0", 10);
        if (retryCount < MAX_RETRIES_PER_SHOT) {
          await supabase.from("shots").update({
            status: "pending",
            error_message: `[retry ${retryCount + 1}] ${shot.error_message || "retrying"}`,
          }).eq("id", shot.id);
          retried.push(shot.id);
        } else {
          failedPermanently.push(shot.id);
        }
      }

      if (shot.status === "generating") {
        const jobRef = parseJobReference(shot.output_url);
        if (jobRef) {
          const providerResult = await checkProviderStatus(jobRef.provider, jobRef.jobId);
          if (providerResult.status === "completed") {
            if (!providerResult.url || isPlaceholderUrl(providerResult.url)) {
              await supabase.from("shots").update({ status: "failed", error_message: `${jobRef.provider} completed but returned invalid media URL` }).eq("id", shot.id);
              continue;
            }
            await supabase.from("shots").update({ status: "completed", output_url: providerResult.url, cost_credits: shot.cost_credits || 2, error_message: null }).eq("id", shot.id);
            continue;
          }
          if (providerResult.status === "failed") {
            await supabase.from("shots").update({ status: "failed", error_message: providerResult.error || `${jobRef.provider} generation failed` }).eq("id", shot.id);
            continue;
          }
        }

        // Stale timeout
        const updated = new Date(shot.updated_at).getTime();
        if (Date.now() - updated > STALE_GENERATING_TIMEOUT_MS) {
          await supabase.from("shots").update({ status: "failed", error_message: `Timed out after ${Math.floor(STALE_GENERATING_TIMEOUT_MS / 60000)} minutes` }).eq("id", shot.id);
        }
      }
    }

    const { data: refreshedShots } = await supabase.from("shots").select("status").eq("project_id", project_id);
    const summary = {
      total: refreshedShots?.length || 0,
      pending: refreshedShots?.filter(s => s.status === "pending").length || 0,
      generating: refreshedShots?.filter(s => s.status === "generating").length || 0,
      completed: refreshedShots?.filter(s => s.status === "completed").length || 0,
      failed: refreshedShots?.filter(s => s.status === "failed").length || 0,
    };

    const allDone = summary.pending === 0 && summary.generating === 0;
    if (allDone && summary.completed > 0) {
      await supabase.from("projects").update({ status: "stitching" }).eq("id", project_id);
    } else if (allDone && summary.completed === 0) {
      await supabase.from("projects").update({ status: "failed" }).eq("id", project_id);
    }

    return new Response(JSON.stringify({ summary, all_done: allDone, retried: retried.length, failed_permanently: failedPermanently.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
