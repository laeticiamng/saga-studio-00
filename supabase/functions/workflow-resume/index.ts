import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * workflow-resume: Resume a paused or failed workflow from its current step.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const { workflow_run_id, from_step } = body;
    if (!workflow_run_id) throw new Error("workflow_run_id required");

    const { data: run, error: runErr } = await supabase
      .from("workflow_runs")
      .select("*")
      .eq("id", workflow_run_id)
      .single();
    if (runErr || !run) throw new Error("Workflow run not found");

    if (run.status !== "paused" && run.status !== "failed") {
      throw new Error(`Cannot resume workflow in status '${run.status}' (must be paused or failed)`);
    }

    const resumeStep = from_step || run.current_step_key;
    if (!resumeStep) throw new Error("No step to resume from");

    // Update workflow run status
    await supabase.from("workflow_runs").update({
      status: "running",
      current_step_key: resumeStep,
      error_message: null,
    }).eq("id", workflow_run_id);

    // Update episode status to match
    if (run.episode_id) {
      await supabase.from("episodes").update({ status: resumeStep }).eq("id", run.episode_id);

      // Re-dispatch pipeline
      const { error: pipelineErr } = await supabase.functions.invoke("episode-pipeline", {
        body: {
          episode_id: run.episode_id,
          force_step: resumeStep,
        },
      });
      if (pipelineErr) throw new Error(`Pipeline dispatch failed: ${pipelineErr.message}`);
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "workflow_resumed",
      entity_type: "workflow_run",
      entity_id: workflow_run_id,
      details: { resume_step: resumeStep, previous_status: run.status },
    });

    return new Response(JSON.stringify({
      message: "Workflow resumed",
      workflow_run_id,
      resume_step: resumeStep,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
