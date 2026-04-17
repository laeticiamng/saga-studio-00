// Phase 4 — per-project budget guardrail helper.
// Wraps `check_project_budget` SQL function so any edge function that is about
// to spend credits can do a pre-flight check.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  spent?: number;
  ceiling?: number;
  attempted?: number;
  mode?: "off" | "shadow" | "enforce";
}

export async function checkProjectBudget(
  supabase: SupabaseClient,
  projectId: string,
  amount: number,
): Promise<BudgetCheckResult> {
  const { data, error } = await supabase.rpc("check_project_budget", {
    p_project_id: projectId,
    p_amount: amount,
  });
  if (error) {
    console.error("[budget] check_project_budget error:", error.message);
    // Fail open to avoid blocking legitimate spends on infra hiccups.
    return { allowed: true, reason: "infra_error" };
  }
  return data as BudgetCheckResult;
}

export function budgetBlockedResponse(r: BudgetCheckResult, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({
      error: "Project budget ceiling exceeded",
      reason: r.reason,
      spent: r.spent,
      ceiling: r.ceiling,
      attempted: r.attempted,
      mode: r.mode,
    }),
    {
      status: 402,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
