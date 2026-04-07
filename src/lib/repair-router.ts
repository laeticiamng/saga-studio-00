/**
 * Repair Router — Maps anomalies to repair actions and manages retry loops.
 */

import { supabase } from "@/integrations/supabase/client";
import type { RepairAction } from "./aberration-taxonomy";

export interface RepairDecision {
  action: RepairAction;
  maxRetries: number;
  escalationAction: string;
  currentAttempt: number;
  shouldEscalate: boolean;
}

/**
 * Decide the best repair action for a given anomaly.
 */
export async function decideRepair(
  anomalyEventId: string,
  category: string
): Promise<RepairDecision> {
  // Get repair policy
  const { data: policy } = await supabase
    .from("repair_policies")
    .select("*")
    .eq("category", category)
    .single();

  // Count existing attempts
  const { count } = await supabase
    .from("repair_attempts")
    .select("*", { count: "exact", head: true })
    .eq("anomaly_event_id", anomalyEventId);

  const currentAttempt = (count ?? 0) + 1;
  const maxRetries = policy?.max_retries ?? 3;
  const shouldEscalate = currentAttempt > maxRetries;

  return {
    action: shouldEscalate
      ? (policy?.escalation_action as RepairAction) ?? "manual_review"
      : (policy?.default_action as RepairAction) ?? "regenerate",
    maxRetries,
    escalationAction: policy?.escalation_action ?? "manual_review",
    currentAttempt,
    shouldEscalate,
  };
}

/**
 * Record a repair attempt.
 */
export async function recordRepairAttempt(params: {
  anomalyEventId: string;
  repairMode: string;
  providerUsed?: string;
  resultAssetId?: string;
  status: "pending" | "success" | "failed";
  attemptNumber: number;
}): Promise<string | null> {
  const { data } = await supabase
    .from("repair_attempts")
    .insert({
      anomaly_event_id: params.anomalyEventId,
      repair_mode: params.repairMode,
      provider_used: params.providerUsed,
      result_asset_id: params.resultAssetId,
      status: params.status,
      attempt_number: params.attemptNumber,
    })
    .select("id")
    .single();

  return data?.id ?? null;
}
