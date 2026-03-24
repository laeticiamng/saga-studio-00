import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * workflow-cancel-safe: Safely cancel a workflow run.
 * Cancels queued agent runs but lets running ones finish.
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
    const { workflow_run_id, reason } = body;
    if (!workflow_run_id) throw new Error("workflow_run_id required");

    const { data: run, error: runErr } = await supabase
      .from("workflow_runs")
      .select("*")
      .eq("id", workflow_run_id)
      .single();
    if (runErr || !run) throw new Error("Workflow run not found");

    if (run.status === "completed" || run.status === "cancelled") {
      throw new Error(`Workflow already ${run.status}`);
    }

    // Cancel queued agent runs (let running ones finish)
    await supabase.from("agent_runs")
      .update({ status: "cancelled" })
      .eq("episode_id", run.episode_id)
      .eq("status", "queued");

    // Cancel pending jobs
    await supabase.from("job_queue")
      .update({ status: "cancelled" })
      .eq("episode_id", run.episode_id)
      .eq("status", "pending");

    // Cancel pending workflow steps
    await supabase.from("workflow_steps")
      .update({ status: "skipped" })
      .eq("workflow_run_id", workflow_run_id)
      .in("status", ["pending", "waiting_approval"]);

    // Update workflow run
    await supabase.from("workflow_runs").update({
      status: "cancelled",
      error_message: reason || "Cancelled by user",
      completed_at: new Date().toISOString(),
    }).eq("id", workflow_run_id);

    // Update episode
    if (run.episode_id) {
      await supabase.from("episodes").update({ status: "cancelled" }).eq("id", run.episode_id);
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "workflow_cancelled",
      entity_type: "workflow_run",
      entity_id: workflow_run_id,
      details: { reason, cancelled_at_step: run.current_step_key },
    });

    return new Response(JSON.stringify({
      message: "Workflow cancelled safely",
      workflow_run_id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
