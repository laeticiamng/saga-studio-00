import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Episode status → agent(s) to run → next status
const PIPELINE_STEPS: Record<string, { agents: string[]; nextStatus: string }> = {
  story_development:  { agents: ["story_architect", "scriptwriter"], nextStatus: "psychology_review" },
  psychology_review:  { agents: ["psychology_reviewer"],             nextStatus: "legal_ethics_review" },
  legal_ethics_review:{ agents: ["legal_ethics_reviewer"],           nextStatus: "visual_bible" },
  visual_bible:       { agents: ["visual_director"],                 nextStatus: "continuity_check" },
  continuity_check:   { agents: ["continuity_checker"],              nextStatus: "shot_generation" },
  shot_generation:    { agents: ["scene_designer", "shot_planner"],  nextStatus: "shot_review" },
  shot_review:        { agents: ["qa_reviewer"],                     nextStatus: "assembly" },
  assembly:           { agents: ["editor"],                          nextStatus: "edit_review" },
  edit_review:        { agents: ["qa_reviewer"],                     nextStatus: "delivery" },
  delivery:           { agents: ["delivery_manager"],                nextStatus: "completed" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { episode_id } = body;
    if (!episode_id) throw new Error("episode_id required");

    // Fetch episode with season chain for authorization
    const { data: episode, error: epErr } = await supabase
      .from("episodes")
      .select(`
        *,
        season:seasons!episodes_season_id_fkey(
          id, series_id,
          series:series!seasons_series_id_fkey(
            id, project_id
          )
        )
      `)
      .eq("id", episode_id)
      .single();
    if (epErr || !episode) throw new Error("Episode not found");

    const currentStatus = episode.status;
    const step = PIPELINE_STEPS[currentStatus];

    if (!step) {
      return new Response(JSON.stringify({
        message: `Episode status '${currentStatus}' is not a pipeline step (may be draft, completed, failed, or cancelled).`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const seriesId = episode.season?.series?.id;
    const agentRuns = [];

    // Dispatch agent runs for this step
    for (const agentSlug of step.agents) {
      const { data: run, error: runErr } = await supabase
        .from("agent_runs")
        .insert({
          agent_slug: agentSlug,
          episode_id: episode.id,
          series_id: seriesId,
          season_id: episode.season?.id,
          status: "queued",
          input: { episode_id: episode.id, trigger_status: currentStatus },
        })
        .select()
        .single();
      if (runErr) throw runErr;
      agentRuns.push(run);

      // Also create a job_queue entry for tracking
      await supabase.from("job_queue").insert({
        project_id: episode.season?.series?.project_id,
        episode_id: episode.id,
        agent_slug: agentSlug,
        step: currentStatus,
        status: "pending",
        payload: { agent_run_id: run.id },
      });
    }

    // Invoke run-agent for each queued agent (fire-and-forget)
    for (const run of agentRuns) {
      supabase.functions.invoke("run-agent", {
        body: { agent_run_id: run.id },
      }).catch(() => { /* fire and forget */ });
    }

    return new Response(JSON.stringify({
      episode_id: episode.id,
      current_status: currentStatus,
      next_status: step.nextStatus,
      agents_dispatched: step.agents,
      agent_runs: agentRuns.map(r => r.id),
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
