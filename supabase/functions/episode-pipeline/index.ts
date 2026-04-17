import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Episode status → agent(s) to run → next status + gate config
const PIPELINE_STEPS: Record<string, {
  agents: string[];
  nextStatus: string;
  requiresApproval: boolean;
  autoAdvanceThreshold: number;
}> = {
  story_development:   { agents: ["story_architect", "scriptwriter"], nextStatus: "psychology_review", requiresApproval: false, autoAdvanceThreshold: 0 },
  psychology_review:   { agents: ["psychology_reviewer"],             nextStatus: "legal_ethics_review", requiresApproval: true, autoAdvanceThreshold: 0.85 },
  legal_ethics_review: { agents: ["legal_ethics_reviewer"],           nextStatus: "visual_bible", requiresApproval: true, autoAdvanceThreshold: 0.90 },
  visual_bible:        { agents: ["visual_director"],                 nextStatus: "continuity_check", requiresApproval: false, autoAdvanceThreshold: 0 },
  continuity_check:    { agents: ["continuity_checker"],              nextStatus: "shot_generation", requiresApproval: true, autoAdvanceThreshold: 0.90 },
  shot_generation:     { agents: ["scene_designer", "shot_planner"],  nextStatus: "shot_review", requiresApproval: false, autoAdvanceThreshold: 0 },
  shot_review:         { agents: ["qa_reviewer"],                     nextStatus: "assembly", requiresApproval: true, autoAdvanceThreshold: 0.80 },
  assembly:            { agents: ["editor"],                          nextStatus: "edit_review", requiresApproval: false, autoAdvanceThreshold: 0 },
  edit_review:         { agents: ["qa_reviewer"],                     nextStatus: "delivery", requiresApproval: true, autoAdvanceThreshold: 0.85 },
  delivery:            { agents: ["delivery_manager"],                nextStatus: "completed", requiresApproval: false, autoAdvanceThreshold: 0 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate JWT — accept both user tokens and service role key (for internal chaining from run-agent)
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const token = authHeader?.replace("Bearer ", "");
    const isServiceRole = token === serviceRoleKey;

    if (!isServiceRole) {
      if (!authHeader) throw new Error("No authorization header");
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token!);
      if (authErr || !user) throw new Error("Unauthorized");
    }

    const body = await req.json();
    const { episode_id, force_step, idempotency_key, chain_depth: incomingDepth } = body;
    if (!episode_id) throw new Error("episode_id required");

    // ── Phase 2 — Circuit breaker (A2) ───────────────────
    // Cap recursive auto-chaining to avoid runaway loops + cost explosion.
    const chainDepth = Number(incomingDepth ?? 0);
    const MAX_CHAIN_DEPTH = 20;
    if (chainDepth > MAX_CHAIN_DEPTH) {
      // Log structured incident, then refuse.
      await supabase.from("diagnostic_events").insert({
        project_id: null,
        severity: "critical",
        scope: "incident",
        event_type: "chain_depth_exceeded",
        title: `episode-pipeline chain_depth ${chainDepth} > ${MAX_CHAIN_DEPTH}`,
        detail: `Episode ${episode_id} aborted to prevent runaway chain.`,
        raw_data: { episode_id, chain_depth: chainDepth, max: MAX_CHAIN_DEPTH },
      });
      return new Response(
        JSON.stringify({
          error: "chain_depth_exceeded",
          chain_depth: chainDepth,
          max: MAX_CHAIN_DEPTH,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Idempotency check: if we already processed this exact request, return cached result
    if (idempotency_key) {
      const { data: existingRun } = await supabase
        .from("workflow_runs")
        .select("*")
        .eq("idempotency_key", idempotency_key)
        .single();
      if (existingRun) {
        return new Response(JSON.stringify({
          message: "Already processed (idempotent)",
          workflow_run_id: existingRun.id,
          status: existingRun.status,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch episode with full chain
    const { data: episode, error: epErr } = await supabase
      .from("episodes")
      .select(`
        *,
        season:seasons!episodes_season_id_fkey(
          id, series_id,
          series:series!seasons_series_id_fkey(
            id, project_id, episode_duration_min
          )
        )
      `)
      .eq("id", episode_id)
      .single();
    if (epErr || !episode) throw new Error("Episode not found");

    // Duration context for agents — 50 min episode ≈ 25-40 scenes ≈ 300-600 shots
    const durationTargetMin = episode.duration_target_min || episode.season?.series?.episode_duration_min || 50;
    const estimatedScenes = Math.ceil(durationTargetMin / 2); // ~2 min per scene avg
    const estimatedShotsPerScene = Math.ceil((durationTargetMin * 60) / (estimatedScenes * 5)); // 5s per shot

    const currentStatus = force_step || episode.status;
    const step = PIPELINE_STEPS[currentStatus];

    if (!step) {
      return new Response(JSON.stringify({
        message: `Episode status '${currentStatus}' is not a pipeline step (may be draft, completed, failed, or cancelled).`,
        episode_status: episode.status,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const seriesId = episode.season?.series?.id;
    const correlationId = crypto.randomUUID();

    // Create or update workflow run for tracking
    let workflowRun;
    if (episode.workflow_run_id) {
      const { data: existingWr } = await supabase
        .from("workflow_runs")
        .select("*")
        .eq("id", episode.workflow_run_id)
        .single();
      if (existingWr && existingWr.status !== "cancelled" && existingWr.status !== "failed") {
        workflowRun = existingWr;
        await supabase.from("workflow_runs").update({
          current_step_key: currentStatus,
          status: "running",
        }).eq("id", workflowRun.id);
      }
    }

    if (!workflowRun) {
      const { data: newWr, error: wrErr } = await supabase
        .from("workflow_runs")
        .insert({
          episode_id: episode.id,
          series_id: seriesId,
          status: "running",
          current_step_key: currentStatus,
          correlation_id: correlationId,
          idempotency_key: idempotency_key || `ep_${episode.id}_${currentStatus}_${Date.now()}`,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (wrErr) throw wrErr;
      workflowRun = newWr;

      // Link workflow run to episode
      await supabase.from("episodes").update({
        workflow_run_id: workflowRun.id,
      }).eq("id", episode.id);
    }

    // Create workflow step record
    const { data: wfStep, error: wfStepErr } = await supabase
      .from("workflow_steps")
      .insert({
        workflow_run_id: workflowRun.id,
        step_key: currentStatus,
        step_order: Object.keys(PIPELINE_STEPS).indexOf(currentStatus) + 1,
        label: currentStatus.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
        status: "running",
        agents: step.agents,
        requires_approval: step.requiresApproval,
        auto_advance_threshold: step.autoAdvanceThreshold || null,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (wfStepErr) throw wfStepErr;

    // Create approval step if this step requires approval
    if (step.requiresApproval) {
      await supabase.from("approval_steps").insert({
        episode_id: episode.id,
        step_name: currentStatus,
        status: "pending",
        reviewer_agent: step.agents[0],
      });

      await supabase.from("workflow_approvals").insert({
        workflow_step_id: wfStep.id,
        decision: "pending",
      });
    }

    const agentRuns = [];

    // Dispatch agent runs for this step with idempotency
    for (const agentSlug of step.agents) {
      const agentIdempotencyKey = `${episode.id}_${currentStatus}_${agentSlug}_${workflowRun.id}`;

      // Check for existing run (idempotency)
      const { data: existingRun } = await supabase
        .from("agent_runs")
        .select("*")
        .eq("idempotency_key", agentIdempotencyKey)
        .single();

      if (existingRun && (existingRun.status === "completed" || existingRun.status === "running")) {
        agentRuns.push(existingRun);
        continue;
      }

      // ── Inject episode-specific corpus data from extracted entities ──
      const episodeCorpus: Record<string, unknown> = {};
      const projectId = episode.season?.series?.project_id;
      if (projectId) {
        const { data: projDocs } = await supabase
          .from("source_documents").select("id").eq("project_id", projectId).neq("status", "parsing_failed");
        const projDocIds = (projDocs || []).map((d: any) => d.id);
        if (projDocIds.length) {
          // Episode-specific entities (matching this episode number)
          const { data: epEntities } = await supabase
            .from("source_document_entities")
            .select("entity_type, entity_key, entity_value")
            .in("document_id", projDocIds)
            .eq("entity_type", "episode")
            .in("status", ["confirmed", "proposed"])
            .gte("extraction_confidence", 0.4)
            .limit(50);
          const matchingEpData = (epEntities || []).filter((e: any) => {
            const val = typeof e.entity_value === "string" ? JSON.parse(e.entity_value) : e.entity_value;
            const num = Number(val.number || val.episode_number || e.entity_key?.match(/\d+/)?.[0]);
            return num === episode.number;
          });
          if (matchingEpData.length) {
            episodeCorpus.episode_data = matchingEpData.map((e: any) => ({
              key: e.entity_key,
              value: typeof e.entity_value === "string" ? JSON.parse(e.entity_value) : e.entity_value,
            }));
          }

          // Scene entities for this episode
          const { data: sceneEnts } = await supabase
            .from("source_document_entities")
            .select("entity_key, entity_value")
            .in("document_id", projDocIds)
            .eq("entity_type", "scene")
            .in("status", ["confirmed", "proposed"])
            .gte("extraction_confidence", 0.4)
            .limit(100);
          const epScenes = (sceneEnts || []).filter((e: any) => {
            const val = typeof e.entity_value === "string" ? JSON.parse(e.entity_value) : e.entity_value;
            return Number(val.episode_number || val.episode) === episode.number;
          });
          if (epScenes.length) {
            episodeCorpus.extracted_scenes = epScenes.map((e: any) => typeof e.entity_value === "string" ? JSON.parse(e.entity_value) : e.entity_value);
          }
        }
      }

      const { data: run, error: runErr } = await supabase
        .from("agent_runs")
        .insert({
          agent_slug: agentSlug,
          episode_id: episode.id,
          series_id: seriesId,
          season_id: episode.season?.id,
          status: "queued",
          idempotency_key: agentIdempotencyKey,
          correlation_id: correlationId,
          input: {
            episode_id: episode.id,
            episode_number: episode.number,
            episode_title: episode.title,
            episode_synopsis: episode.synopsis || null,
            trigger_status: currentStatus,
            workflow_run_id: workflowRun.id,
            workflow_step_id: wfStep.id,
            duration_target_min: durationTargetMin,
            estimated_scenes: estimatedScenes,
            estimated_shots_per_scene: estimatedShotsPerScene,
            total_estimated_shots: estimatedScenes * estimatedShotsPerScene,
            ...episodeCorpus,
          },
        })
        .select()
        .single();
      if (runErr) throw runErr;
      agentRuns.push(run);

      // Link to workflow step
      await supabase.from("workflow_step_runs").insert({
        workflow_step_id: wfStep.id,
        agent_run_id: run.id,
      });

      // Job queue entry
      await supabase.from("job_queue").insert({
        project_id: episode.season?.series?.project_id,
        episode_id: episode.id,
        agent_slug: agentSlug,
        step: currentStatus,
        status: "pending",
        payload: {
          agent_run_id: run.id,
          workflow_run_id: workflowRun.id,
          correlation_id: correlationId,
        },
      });
    }

    // Invoke run-agent for each queued agent
    for (const run of agentRuns) {
      if (run.status === "queued") {
        supabase.functions.invoke("run-agent", {
          body: {
            agent_run_id: run.id,
            correlation_id: correlationId,
          },
        }).catch((err: unknown) => {
          // Log failure but don't block — dead letter handling via job_queue
          console.error(`Failed to invoke run-agent for ${run.id}:`, err);
        });
      }
    }

    // Audit log
    await supabase.functions.invoke("audit-log", {
      body: {
        action: "episode_pipeline_step_dispatched",
        entity_type: "episode",
        entity_id: episode.id,
        details: {
          step: currentStatus,
          next_status: step.nextStatus,
          agents: step.agents,
          workflow_run_id: workflowRun.id,
          correlation_id: correlationId,
          requires_approval: step.requiresApproval,
        },
      },
    }).catch(() => {});

    return new Response(JSON.stringify({
      episode_id: episode.id,
      current_status: currentStatus,
      next_status: step.nextStatus,
      agents_dispatched: step.agents,
      agent_runs: agentRuns.map(r => r.id),
      workflow_run_id: workflowRun.id,
      workflow_step_id: wfStep.id,
      correlation_id: correlationId,
      requires_approval: step.requiresApproval,
      auto_advance_threshold: step.autoAdvanceThreshold,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("episode-pipeline error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
