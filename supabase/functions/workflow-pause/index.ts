import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * workflow-pause: Pause a running workflow. Running agents will complete but no new step starts.
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
    const { workflow_run_id } = body;
    if (!workflow_run_id) throw new Error("workflow_run_id required");

    const { data: run, error: runErr } = await supabase
      .from("workflow_runs")
      .select("*")
      .eq("id", workflow_run_id)
      .single();
    if (runErr || !run) throw new Error("Workflow run not found");

    if (run.status !== "running") {
      throw new Error(`Cannot pause workflow in status '${run.status}'`);
    }

    await supabase.from("workflow_runs").update({ status: "paused" }).eq("id", workflow_run_id);

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "workflow_paused",
      entity_type: "workflow_run",
      entity_id: workflow_run_id,
      details: { paused_at_step: run.current_step_key },
    });

    return new Response(JSON.stringify({
      message: "Workflow paused",
      workflow_run_id,
      paused_at_step: run.current_step_key,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
