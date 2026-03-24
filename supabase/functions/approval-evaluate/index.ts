import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * approval-evaluate: Process a human approval/rejection decision.
 * When a step is waiting_approval, this function:
 * 1. Records the decision
 * 2. Updates approval_steps and workflow_approvals
 * 3. If approved: advances the episode pipeline
 * 4. If rejected: marks workflow step as rejected
 * 5. If revision_requested: re-runs the step agents
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

    const body = await req.json();
    const { episode_id, step_name, decision, reason } = body;

    if (!episode_id || !step_name || !decision) {
      throw new Error("episode_id, step_name, and decision required");
    }
    if (!["approved", "rejected", "revision_requested"].includes(decision)) {
      throw new Error("decision must be approved, rejected, or revision_requested");
    }

    // Fetch episode
    const { data: episode, error: epErr } = await supabase
      .from("episodes")
      .select("*, workflow_run_id")
      .eq("id", episode_id)
      .single();
    if (epErr || !episode) throw new Error("Episode not found");

    // Update approval_steps
    await supabase.from("approval_steps")
      .update({
        status: decision,
        reviewer_user: user.id,
        notes: reason || null,
      })
      .eq("episode_id", episode_id)
      .eq("step_name", step_name);

    // Record approval decision
    const { data: approvalStep } = await supabase
      .from("approval_steps")
      .select("id")
      .eq("episode_id", episode_id)
      .eq("step_name", step_name)
      .single();

    if (approvalStep) {
      await supabase.from("approval_decisions").insert({
        approval_step_id: approvalStep.id,
        decision,
        reason: reason || null,
        decided_by: user.id,
      });
    }

    // Update workflow step and approval
    if (episode.workflow_run_id) {
      const { data: wfStep } = await supabase
        .from("workflow_steps")
        .select("id")
        .eq("workflow_run_id", episode.workflow_run_id)
        .eq("step_key", step_name)
        .single();

      if (wfStep) {
        await supabase.from("workflow_steps").update({
          status: decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "running",
          completed_at: decision !== "revision_requested" ? new Date().toISOString() : null,
        }).eq("id", wfStep.id);

        await supabase.from("workflow_approvals").update({
          decision,
          decided_by_user: user.id,
          reason: reason || null,
        }).eq("workflow_step_id", wfStep.id);
      }
    }

    // Status transition map
    const STATUS_TRANSITIONS: Record<string, string> = {
      story_development: "psychology_review",
      psychology_review: "legal_ethics_review",
      legal_ethics_review: "visual_bible",
      visual_bible: "continuity_check",
      continuity_check: "shot_generation",
      shot_generation: "shot_review",
      shot_review: "assembly",
      assembly: "edit_review",
      edit_review: "delivery",
      delivery: "completed",
    };

    let result: Record<string, unknown> = { decision };

    if (decision === "approved") {
      const nextStatus = STATUS_TRANSITIONS[step_name];
      if (nextStatus) {
        await supabase.from("episodes").update({ status: nextStatus }).eq("id", episode_id);

        // Update workflow run
        if (episode.workflow_run_id) {
          await supabase.from("workflow_runs").update({
            current_step_key: nextStatus === "completed" ? null : nextStatus,
            status: nextStatus === "completed" ? "completed" : "running",
            completed_at: nextStatus === "completed" ? new Date().toISOString() : null,
          }).eq("id", episode.workflow_run_id);
        }

        // Continue pipeline
        if (nextStatus !== "completed") {
          supabase.functions.invoke("episode-pipeline", {
            body: { episode_id },
          }).catch(() => {});
        }
        result.next_status = nextStatus;
      }
    } else if (decision === "rejected") {
      await supabase.from("episodes").update({ status: "failed" }).eq("id", episode_id);
      if (episode.workflow_run_id) {
        await supabase.from("workflow_runs").update({
          status: "failed",
          error_message: `Step '${step_name}' rejected by user: ${reason || "no reason given"}`,
        }).eq("id", episode.workflow_run_id);
      }
    } else if (decision === "revision_requested") {
      // Re-run the step
      supabase.functions.invoke("episode-pipeline", {
        body: { episode_id, force_step: step_name },
      }).catch(() => {});
      result.message = "Step re-running with revision";
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: `approval_${decision}`,
      entity_type: "episode",
      entity_id: episode_id,
      details: { step_name, decision, reason, ...result },
    });

    return new Response(JSON.stringify(result), {
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
