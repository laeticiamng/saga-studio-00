/**
 * Governance Engine — Central policy checker and state transition guard.
 * All governance logic flows through this module.
 */

import { supabase } from "@/integrations/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────

export type GovernanceState =
  | "draft"
  | "setup_in_progress"
  | "awaiting_identity_review"
  | "awaiting_world_review"
  | "planning"
  | "awaiting_scene_review"
  | "generating"
  | "awaiting_clip_review"
  | "assembling"
  | "awaiting_rough_cut_review"
  | "fine_cut_in_progress"
  | "awaiting_fine_cut_review"
  | "qc_pending"
  | "export_ready"
  | "exporting"
  | "delivered"
  | "failed"
  | "archived";

export const GOVERNANCE_STATES: GovernanceState[] = [
  "draft", "setup_in_progress", "awaiting_identity_review", "awaiting_world_review",
  "planning", "awaiting_scene_review", "generating", "awaiting_clip_review",
  "assembling", "awaiting_rough_cut_review", "fine_cut_in_progress",
  "awaiting_fine_cut_review", "qc_pending", "export_ready", "exporting",
  "delivered", "failed", "archived",
];

export const GOVERNANCE_STATE_LABELS: Record<GovernanceState, string> = {
  draft: "Brouillon",
  setup_in_progress: "Configuration en cours",
  awaiting_identity_review: "Revue identité en attente",
  awaiting_world_review: "Revue univers en attente",
  planning: "Planification",
  awaiting_scene_review: "Revue scènes en attente",
  generating: "Génération en cours",
  awaiting_clip_review: "Revue clips en attente",
  assembling: "Assemblage en cours",
  awaiting_rough_cut_review: "Revue rough cut en attente",
  fine_cut_in_progress: "Fine cut en cours",
  awaiting_fine_cut_review: "Revue fine cut en attente",
  qc_pending: "QC en attente",
  export_ready: "Prêt à exporter",
  exporting: "Export en cours",
  delivered: "Livré",
  failed: "Échec",
  archived: "Archivé",
};

export type ActorType = "user" | "system" | "provider" | "automation" | "admin";

export interface GovernancePolicy {
  policy_key: string;
  domain: string;
  description: string | null;
  rule: Record<string, unknown>;
  enforcement_mode: "block" | "warn" | "log";
  is_active: boolean;
}

export interface TransitionGuard {
  from_state: string;
  to_state: string;
  required_approvals: Array<{ gate: string }>;
  guard_conditions: Array<{ check: string }>;
}

export interface PolicyCheckResult {
  allowed: boolean;
  policy_key: string;
  enforcement_mode: "block" | "warn" | "log";
  reason?: string;
}

export interface TransitionCheckResult {
  allowed: boolean;
  from: string;
  to: string;
  reason?: string;
  blocked_by?: string[];
}

// ─── Transition Checking ─────────────────────────────────────────────

/** Check if a governance state transition is allowed based on DB rules */
export async function checkTransition(
  projectId: string,
  fromState: GovernanceState,
  toState: GovernanceState
): Promise<TransitionCheckResult> {
  const { data: transitions } = await supabase
    .from("governance_transitions")
    .select("*")
    .eq("domain", "project")
    .eq("from_state", fromState)
    .eq("to_state", toState)
    .eq("is_active", true)
    .limit(1);

  if (!transitions || transitions.length === 0) {
    return {
      allowed: false,
      from: fromState,
      to: toState,
      reason: `Transition ${fromState} → ${toState} is not defined in governance rules`,
    };
  }

  return { allowed: true, from: fromState, to: toState };
}

/** Get all valid next states from current state */
export async function getValidTransitions(
  currentState: GovernanceState
): Promise<GovernanceState[]> {
  const { data } = await supabase
    .from("governance_transitions")
    .select("to_state")
    .eq("domain", "project")
    .eq("from_state", currentState)
    .eq("is_active", true);

  return (data?.map((t) => t.to_state as GovernanceState)) ?? [];
}

// ─── Policy Checking ─────────────────────────────────────────────────

/** Check a specific policy */
export async function checkPolicy(
  policyKey: string
): Promise<PolicyCheckResult> {
  const { data } = await supabase
    .from("governance_policies")
    .select("*")
    .eq("policy_key", policyKey)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!data) {
    return { allowed: true, policy_key: policyKey, enforcement_mode: "log" };
  }

  // Policy exists and is active — enforcement depends on caller context
  return {
    allowed: true,
    policy_key: policyKey,
    enforcement_mode: data.enforcement_mode as "block" | "warn" | "log",
  };
}

// ─── Violation Logging ───────────────────────────────────────────────

export async function logViolation(params: {
  policy_key: string;
  entity_type: string;
  entity_id?: string;
  project_id: string;
  actor_type: ActorType;
  actor_id?: string;
  reason: string;
  severity?: string;
}): Promise<void> {
  await supabase.from("governance_violations").insert({
    policy_key: params.policy_key,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    project_id: params.project_id,
    actor_type: params.actor_type,
    actor_id: params.actor_id,
    reason: params.reason,
    severity: params.severity ?? "warning",
  });
}

// ─── Governance State Transition ─────────────────────────────────────

/** Attempt to transition a project's governance state with full validation */
export async function transitionGovernanceState(
  projectId: string,
  toState: GovernanceState,
  actorType: ActorType = "user",
  actorId?: string
): Promise<TransitionCheckResult> {
  // Get current state
  const { data: project } = await supabase
    .from("projects")
    .select("governance_state")
    .eq("id", projectId)
    .single();

  if (!project) {
    return { allowed: false, from: "unknown", to: toState, reason: "Project not found" };
  }

  const fromState = (project.governance_state ?? "draft") as GovernanceState;
  const check = await checkTransition(projectId, fromState, toState);

  if (!check.allowed) {
    await logViolation({
      policy_key: "no_hidden_transitions",
      entity_type: "project",
      entity_id: projectId,
      project_id: projectId,
      actor_type: actorType,
      actor_id: actorId,
      reason: check.reason ?? "Blocked transition",
      severity: "warning",
    });
    return check;
  }

  // Apply transition
  await supabase
    .from("projects")
    .update({ governance_state: toState })
    .eq("id", projectId);

  return { allowed: true, from: fromState, to: toState };
}

// ─── Incident Management ─────────────────────────────────────────────

export async function createIncident(params: {
  project_id: string;
  scope: string;
  scope_id?: string;
  severity: "info" | "warning" | "blocking" | "critical";
  root_cause_class?: string;
  title: string;
  detail?: string;
}): Promise<string | null> {
  const { data } = await supabase
    .from("incidents")
    .insert({
      project_id: params.project_id,
      scope: params.scope,
      scope_id: params.scope_id,
      severity: params.severity,
      root_cause_class: params.root_cause_class,
      title: params.title,
      detail: params.detail,
      status: "open",
    })
    .select("id")
    .single();

  return data?.id ?? null;
}
