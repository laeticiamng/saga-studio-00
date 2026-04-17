import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-correlation-id",
};

const BATCH_CHUNK_SIZE = 20; // Process shots in chunks of 20

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) throw new Error("Unauthorized");

    // P3.6: rate limit — 5/min/user (renders are very expensive)
    const rl = await checkRateLimit(supabase, user.id, {
      endpoint: "batch-render", cost: 1, capacity: 5, refillPerMinute: 5,
    });
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    const body = await req.json();
    const { series_id, season_id, episode_ids } = body;

    if (!series_id) throw new Error("series_id required");
    if (!episode_ids || !Array.isArray(episode_ids) || episode_ids.length === 0) {
      throw new Error("episode_ids array required");
    }

    // Calculate total estimated shots for progress tracking
    let totalEstimatedShots = 0;
    for (const epId of episode_ids) {
      const { count } = await supabase
        .from("episode_shots")
        .select("id", { count: "exact", head: true })
        .eq("episode_id", epId);
      totalEstimatedShots += count || 0;
    }

    // If no episode_shots yet, estimate from scenes
    if (totalEstimatedShots === 0) {
      for (const epId of episode_ids) {
        const { data: ep } = await supabase
          .from("episodes")
          .select("duration_target_min")
          .eq("id", epId)
          .single();
        // 50min episode ≈ 600 shots at 5s each
        totalEstimatedShots += Math.ceil(((ep?.duration_target_min || 50) * 60) / 5);
      }
    }

    // Create render batch with chunking info
    const totalBatches = Math.ceil(totalEstimatedShots / BATCH_CHUNK_SIZE);

    const { data: batch, error: batchErr } = await supabase
      .from("render_batches")
      .insert({
        series_id,
        season_id: season_id || null,
        episode_ids,
        status: "processing",
        progress: {
          completed: 0,
          total: episode_ids.length,
          total_shots: totalEstimatedShots,
          total_batches: totalBatches,
          batches_completed: 0,
          current: null,
        },
      })
      .select()
      .single();
    if (batchErr) throw batchErr;

    // Trigger stitch-render for each episode in sequence
    // For 50min episodes, shots are processed in chunks
    for (const epId of episode_ids) {
      const { data: episode } = await supabase
        .from("episodes")
        .select("project_id, duration_target_min")
        .eq("id", epId)
        .single();

      if (episode?.project_id) {
        supabase.functions.invoke("stitch-render", {
          body: {
            project_id: episode.project_id,
            episode_id: epId,
            batch_id: batch.id,
            chunk_size: BATCH_CHUNK_SIZE,
            duration_target_min: episode.duration_target_min || 50,
          },
        }).catch(() => { /* fire and forget */ });
      }
    }

    // Audit
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "batch_render_started",
      entity_type: "render_batch",
      entity_id: batch.id,
      details: {
        series_id,
        episode_count: episode_ids.length,
        total_estimated_shots: totalEstimatedShots,
        total_batches: totalBatches,
      },
    });

    return new Response(JSON.stringify({
      batch,
      total_estimated_shots: totalEstimatedShots,
      chunk_size: BATCH_CHUNK_SIZE,
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
