// Reaper — detects and marks stuck jobs as failed.
// Runs on a schedule (cron) or can be invoked manually by admins.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Conservative thresholds. Some agents are legitimately slow.
const AGENT_RUN_TIMEOUT_MIN = 15;
const WORKFLOW_RUN_TIMEOUT_HR = 2;
const EXPORT_TIMEOUT_HR = 1;

// Agents known to be slow — exclude or use longer timeout.
const SLOW_AGENTS = new Set<string>([
  "delivery_supervisor",
  "delivery_manager",
  "redaction_pass",
]);
const SLOW_AGENT_TIMEOUT_MIN = 45;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Authentication: either service_role (cron) or admin user.
  const authHeader = req.headers.get("Authorization") ?? "";
  const isServiceRole = authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "__none__");

  if (!isServiceRole) {
    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const errors: Array<{ scope: string; error: string }> = [];
  const details: Record<string, unknown> = {};

  // Insert reaper_runs row early so we can update it at end.
  const { data: runRow } = await supabase
    .from("reaper_runs")
    .insert({})
    .select()
    .single();
  const runId = runRow?.id;

  // ── 1. Agent runs ───────────────────────────────────────
  let agentReaped = 0;
  try {
    const cutoffNormal = new Date(Date.now() - AGENT_RUN_TIMEOUT_MIN * 60_000).toISOString();
    const cutoffSlow = new Date(Date.now() - SLOW_AGENT_TIMEOUT_MIN * 60_000).toISOString();

    const { data: stuck } = await supabase
      .from("agent_runs")
      .select("id, agent_slug, started_at")
      .in("status", ["running", "queued"])
      .lt("started_at", cutoffNormal)
      .limit(200);

    if (stuck) {
      const toReap = stuck.filter((r) => {
        if (SLOW_AGENTS.has(r.agent_slug)) {
          return r.started_at && r.started_at < cutoffSlow;
        }
        return true;
      });

      if (toReap.length > 0) {
        const ids = toReap.map((r) => r.id);
        const { error } = await supabase
          .from("agent_runs")
          .update({
            status: "failed",
            error_message: "Reaped: exceeded timeout",
            completed_at: new Date().toISOString(),
          })
          .in("id", ids);
        if (error) throw error;
        agentReaped = toReap.length;
        details.agent_runs_reaped = toReap.map((r) => ({ id: r.id, slug: r.agent_slug }));

        // Emit diagnostic events grouped by project
        for (const r of toReap) {
          await supabase.from("audit_logs").insert({
            entity_type: "agent_run",
            entity_id: r.id,
            action: "reaped",
            details: { agent_slug: r.agent_slug, reason: "timeout" },
          });
        }
      }
    }
  } catch (e) {
    errors.push({ scope: "agent_runs", error: e instanceof Error ? e.message : String(e) });
  }

  // ── 2. Workflow runs ────────────────────────────────────
  let workflowReaped = 0;
  try {
    const cutoff = new Date(Date.now() - WORKFLOW_RUN_TIMEOUT_HR * 3600_000).toISOString();
    const { data: stuck } = await supabase
      .from("workflow_runs")
      .select("id")
      .eq("status", "running")
      .lt("created_at", cutoff)
      .limit(50);

    if (stuck && stuck.length > 0) {
      const ids = stuck.map((r) => r.id);
      const { error } = await supabase
        .from("workflow_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
        })
        .in("id", ids);
      if (error) throw error;
      workflowReaped = stuck.length;
      details.workflow_runs_reaped = ids;
    }
  } catch (e) {
    errors.push({ scope: "workflow_runs", error: e instanceof Error ? e.message : String(e) });
  }

  // ── 3. Export versions ──────────────────────────────────
  let exportsReaped = 0;
  try {
    const cutoff = new Date(Date.now() - EXPORT_TIMEOUT_HR * 3600_000).toISOString();
    const { data: stuck } = await supabase
      .from("export_versions")
      .select("id")
      .eq("status", "pending")
      .lt("created_at", cutoff)
      .limit(50);

    if (stuck && stuck.length > 0) {
      const ids = stuck.map((r) => r.id);
      const { error } = await supabase
        .from("export_versions")
        .update({
          status: "failed",
          failure_stage: "reaper_timeout",
        })
        .in("id", ids);
      if (error) throw error;
      exportsReaped = stuck.length;
      details.exports_reaped = ids;
    }
  } catch (e) {
    errors.push({ scope: "exports", error: e instanceof Error ? e.message : String(e) });
  }

  // Update reaper_runs row
  if (runId) {
    await supabase
      .from("reaper_runs")
      .update({
        completed_at: new Date().toISOString(),
        agent_runs_reaped: agentReaped,
        workflow_runs_reaped: workflowReaped,
        exports_reaped: exportsReaped,
        errors,
        details,
      })
      .eq("id", runId);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      run_id: runId,
      reaped: {
        agent_runs: agentReaped,
        workflow_runs: workflowReaped,
        exports: exportsReaped,
      },
      errors,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
