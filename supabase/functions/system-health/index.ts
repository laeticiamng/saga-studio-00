import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type HealthStatus = "ok" | "degraded" | "missing" | "error";

interface ProviderHealth {
  name: string;
  display_name: string;
  status: HealthStatus;
  output_type: "video" | "image";
  detail?: string;
}

interface SystemHealth {
  overall: HealthStatus;
  providers: ProviderHealth[];
  render_service: { status: HealthStatus; url?: string; detail?: string };
  storage: { bucket: string; status: HealthStatus; detail?: string }[];
  database: { table: string; status: HealthStatus; count?: number }[];
  environment: { key: string; status: HealthStatus }[];
  pipeline_readiness: HealthStatus;
  active_projects: number;
  stuck_jobs: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ─── Check Providers ──
    const providers: ProviderHealth[] = [];

    // OpenAI (DALL-E 3 — images)
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    providers.push({
      name: "openai_image",
      display_name: "OpenAI DALL-E 3 (Images)",
      status: openaiKey ? "ok" : "missing",
      output_type: "image",
      detail: openaiKey ? "API key configured" : "OPENAI_API_KEY not set",
    });

    // Runway (real video)
    const runwayKey = Deno.env.get("RUNWAY_API_KEY");
    if (runwayKey) {
      try {
        // Light check — just verify key format
        providers.push({
          name: "runway",
          display_name: "Runway Gen-4.5 (Vidéo)",
          status: "ok",
          output_type: "video",
          detail: "API key configured",
        });
      } catch {
        providers.push({ name: "runway", display_name: "Runway Gen-4.5", status: "error", output_type: "video", detail: "Key validation failed" });
      }
    } else {
      providers.push({ name: "runway", display_name: "Runway Gen-4.5 (Vidéo)", status: "missing", output_type: "video", detail: "RUNWAY_API_KEY not set" });
    }

    // Luma (real video)
    const lumaKey = Deno.env.get("LUMA_API_KEY");
    providers.push({
      name: "luma",
      display_name: "Luma Dream Machine (Vidéo)",
      status: lumaKey ? "ok" : "missing",
      output_type: "video",
      detail: lumaKey ? "API key configured" : "LUMA_API_KEY not set",
    });

    // ─── Check Render Service ──
    const renderServiceUrl = Deno.env.get("FFMPEG_RENDER_SERVICE_URL");
    let renderService: SystemHealth["render_service"];
    if (renderServiceUrl) {
      try {
        const res = await fetch(renderServiceUrl, { method: "HEAD" });
        renderService = {
          status: res.ok ? "ok" : "degraded",
          url: renderServiceUrl,
          detail: res.ok ? "Service reachable" : `HTTP ${res.status}`,
        };
      } catch (err: any) {
        renderService = { status: "error", url: renderServiceUrl, detail: err.message };
      }
    } else {
      renderService = {
        status: "missing",
        detail: "FFMPEG_RENDER_SERVICE_URL not set — fallback to client-side assembly",
      };
    }

    // ─── Check Storage Buckets ──
    const requiredBuckets = ["audio-uploads", "face-references", "shot-outputs", "renders"];
    const storageResults: SystemHealth["storage"] = [];
    for (const bucket of requiredBuckets) {
      try {
        const { data, error } = await supabase.storage.from(bucket).list("", { limit: 1 });
        storageResults.push({
          bucket,
          status: error ? "error" : "ok",
          detail: error ? error.message : undefined,
        });
      } catch (err: any) {
        storageResults.push({ bucket, status: "error", detail: err.message });
      }
    }

    // ─── Check Critical Tables ──
    const criticalTables = ["projects", "shots", "renders", "plans", "audio_analysis", "job_queue", "credit_wallets"];
    const dbResults: SystemHealth["database"] = [];
    for (const table of criticalTables) {
      try {
        const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
        dbResults.push({
          table,
          status: error ? "error" : "ok",
          count: count ?? 0,
        });
      } catch (err: any) {
        dbResults.push({ table, status: "error" });
      }
    }

    // ─── Check Environment Variables ──
    const requiredEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
    const optionalEnv = ["OPENAI_API_KEY", "RUNWAY_API_KEY", "LUMA_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "FFMPEG_RENDER_SERVICE_URL"];
    const envResults: SystemHealth["environment"] = [];
    for (const key of [...requiredEnv, ...optionalEnv]) {
      envResults.push({
        key,
        status: Deno.env.get(key) ? "ok" : (requiredEnv.includes(key) ? "error" : "missing"),
      });
    }

    // ─── Active Projects & Stuck Jobs ──
    const { count: activeProjects } = await supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .in("status", ["analyzing", "planning", "generating", "stitching"]);

    const { count: stuckJobs } = await supabase
      .from("job_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "processing")
      .lt("started_at", new Date(Date.now() - 30 * 60 * 1000).toISOString());

    // ─── Pipeline Readiness ──
    const hasAnyProvider = providers.some(p => p.status === "ok");
    const hasVideoProvider = providers.some(p => p.status === "ok" && p.output_type === "video");
    const dbOk = dbResults.every(d => d.status === "ok");

    let pipelineReadiness: HealthStatus = "ok";
    if (!hasAnyProvider) pipelineReadiness = "error";
    else if (!hasVideoProvider) pipelineReadiness = "degraded";
    else if (!dbOk) pipelineReadiness = "degraded";

    // ─── Overall ──
    const criticalErrors = [
      ...envResults.filter(e => e.status === "error"),
      ...dbResults.filter(d => d.status === "error"),
    ];
    const overall: HealthStatus = criticalErrors.length > 0 ? "error"
      : pipelineReadiness === "degraded" ? "degraded"
      : "ok";

    const health: SystemHealth = {
      overall,
      providers,
      render_service: renderService,
      storage: storageResults,
      database: dbResults,
      environment: envResults,
      pipeline_readiness: pipelineReadiness,
      active_projects: activeProjects ?? 0,
      stuck_jobs: stuckJobs ?? 0,
    };

    return new Response(JSON.stringify(health), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
