// DLQ actions — admin-only Replay / Discard / Escalate for dead-letter jobs.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Action = "replay" | "discard" | "escalate";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Auth: admin only
  const authHeader = req.headers.get("Authorization") ?? "";
  const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userData.user.id, _role: "admin",
  });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Admin only" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { job_id?: string; job_type?: string; action?: Action; reason?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { job_id, job_type, action, reason } = body;
  if (!job_id || !job_type || !action) {
    return new Response(JSON.stringify({ error: "job_id, job_type, action required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!["replay", "discard", "escalate"].includes(action)) {
    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let result: Record<string, unknown> = { job_id, job_type, action };

  try {
    if (job_type === "agent_run") {
      if (action === "replay") {
        // Reset to queued, increment retry_count, dispatch run-agent
        const { data: run } = await supabase
          .from("agent_runs")
          .select("id, episode_id, agent_slug, retry_count, max_retries")
          .eq("id", job_id)
          .single();
        if (!run) throw new Error("Agent run not found");
        await supabase
          .from("agent_runs")
          .update({
            status: "queued",
            error_message: null,
            completed_at: null,
            started_at: null,
            retry_count: (run.retry_count ?? 0) + 1,
            max_retries: Math.max(run.max_retries ?? 3, (run.retry_count ?? 0) + 2),
          })
          .eq("id", job_id);
        // Fire and forget
        supabase.functions
          .invoke("run-agent", { body: { agent_run_id: job_id, manual_replay: true } })
          .catch(() => {});
        result.dispatched = true;
      } else if (action === "discard") {
        await supabase
          .from("agent_runs")
          .update({ error_message: `Discarded by admin: ${reason ?? "n/a"}` })
          .eq("id", job_id);
      } else if (action === "escalate") {
        const { data: run } = await supabase
          .from("agent_runs").select("episode_id, agent_slug").eq("id", job_id).single();
        await supabase.from("diagnostic_events").insert({
          project_id: null,
          severity: "critical",
          scope: "incident",
          event_type: "dlq_escalated",
          title: `Job DLQ escalated: ${run?.agent_slug ?? "?"}`,
          detail: reason ?? "Manual escalation by admin",
          raw_data: { job_id, job_type, episode_id: run?.episode_id },
        });
      }
    } else if (job_type === "export_version") {
      if (action === "replay") {
        await supabase
          .from("export_versions")
          .update({ status: "pending", failure_stage: null, retry_count: 0 })
          .eq("id", job_id);
        result.dispatched = true;
      } else if (action === "discard") {
        await supabase
          .from("export_versions")
          .update({ failure_stage: `discarded_by_admin:${reason ?? "n/a"}` })
          .eq("id", job_id);
      } else if (action === "escalate") {
        await supabase.from("diagnostic_events").insert({
          project_id: null,
          severity: "critical",
          scope: "incident",
          event_type: "dlq_escalated",
          title: "Export DLQ escalated",
          detail: reason ?? "Manual escalation by admin",
          raw_data: { job_id, job_type },
        });
      }
    } else {
      throw new Error(`Unknown job_type: ${job_type}`);
    }

    await supabase.from("audit_logs").insert({
      entity_type: job_type,
      entity_id: job_id,
      action: `dlq_${action}`,
      user_id: userData.user.id,
      details: { reason },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({ ok: true, ...result }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
