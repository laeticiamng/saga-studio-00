import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";
import { getOrCreateCorrelationId } from "../_shared/correlation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-correlation-id",
};

/**
 * autopilot-run: Starts the full autopilot pipeline for an episode.
 * 1. Sets episode status to story_development (first pipeline step)
 * 2. Creates a workflow run
 * 3. Dispatches the first step via episode-pipeline
 * 4. Subsequent steps auto-chain via run-agent → maybeAdvanceEpisode → episode-pipeline
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) throw new Error("Unauthorized");

    // P3.6: rate limit — 10/min/user (autopilot is expensive)
    const rl = await checkRateLimit(supabase, user.id, {
      endpoint: "autopilot-run", cost: 1, capacity: 10, refillPerMinute: 10,
    });
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    const body = await req.json();
    const { episode_id, auto_approve_threshold } = body;
    if (!episode_id) throw new Error("episode_id required");

    // Fetch episode
    const { data: episode, error: epErr } = await supabase
      .from("episodes")
      .select(`*, season:seasons!episodes_season_id_fkey(id, series_id, series:series!seasons_series_id_fkey(id, project_id))`)
      .eq("id", episode_id)
      .single();
    if (epErr || !episode) throw new Error("Episode not found");

    // Only start from draft
    if (episode.status !== "draft") {
      throw new Error(`Episode must be in 'draft' status to start autopilot (current: ${episode.status})`);
    }

    const seriesId = episode.season?.series?.id;
    const correlationId = getOrCreateCorrelationId(req);
    const idempotencyKey = `autopilot_${episode_id}_${Date.now()}`;

    // Set episode to first pipeline step
    await supabase.from("episodes").update({ status: "story_development" }).eq("id", episode_id);

    // Dispatch the first step
    const { data: pipelineResult, error: pipelineErr } = await supabase.functions.invoke("episode-pipeline", {
      body: {
        episode_id,
        idempotency_key: idempotencyKey,
        correlation_id: correlationId,
      },
      headers: { "x-correlation-id": correlationId },
    });

    if (pipelineErr) throw new Error(`Pipeline dispatch failed: ${pipelineErr.message}`);

    const workflowRunId = pipelineResult?.workflow_run_id || null;

    // Audit log
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "autopilot_started",
      entity_type: "episode",
      entity_id: episode_id,
      correlation_id: correlationId,
      details: {
        series_id: seriesId,
        auto_approve_threshold: auto_approve_threshold || 0.85,
        workflow_run_id: workflowRunId,
        pipeline_result: pipelineResult,
      },
    });

    return new Response(JSON.stringify({
      message: "Autopilot started",
      episode_id,
      correlation_id: correlationId,
      workflow_run_id: workflowRunId,
      pipeline_result: pipelineResult,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
