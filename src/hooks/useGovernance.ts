import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { GovernanceState, ActorType } from "@/lib/governance-engine";
import { transitionGovernanceState } from "@/lib/governance-engine";

// ─── Governance Policies ──────────────────────────────────────────────

export function useGovernancePolicies() {
  return useQuery({
    queryKey: ["governance-policies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("governance_policies")
        .select("*")
        .eq("is_active", true)
        .order("domain");
      if (error) throw error;
      return data;
    },
  });
}

// ─── Governance Transitions ──────────────────────────────────────────

export function useGovernanceTransitions(domain = "project") {
  return useQuery({
    queryKey: ["governance-transitions", domain],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("governance_transitions")
        .select("*")
        .eq("domain", domain)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });
}

// ─── Governance Violations ───────────────────────────────────────────

export function useGovernanceViolations(projectId?: string) {
  return useQuery({
    queryKey: ["governance-violations", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("governance_violations")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}

// ─── Incidents ───────────────────────────────────────────────────────

export function useIncidents(projectId?: string) {
  return useQuery({
    queryKey: ["incidents", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}

// ─── Project Governance State ────────────────────────────────────────

export function useProjectGovernanceState(projectId?: string) {
  return useQuery({
    queryKey: ["project-governance-state", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, governance_state, status")
        .eq("id", projectId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

// ─── Transition Mutation ─────────────────────────────────────────────

export function useGovernanceTransition(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      toState,
      actorType = "user",
      actorId,
    }: {
      toState: GovernanceState;
      actorType?: ActorType;
      actorId?: string;
    }) => {
      const result = await transitionGovernanceState(projectId, toState, actorType, actorId);
      if (!result.allowed) throw new Error(result.reason ?? "Transition blocked");
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-governance-state", projectId] });
      qc.invalidateQueries({ queryKey: ["governance-violations", projectId] });
    },
    onError: (e: Error) => {
      toast.error(`Transition bloquée: ${e.message}`);
    },
  });
}

// ─── Composite Governance Dashboard Data ─────────────────────────────

export function useProjectGovernanceDashboard(projectId?: string) {
  const state = useProjectGovernanceState(projectId);
  const violations = useGovernanceViolations(projectId);
  const incidents = useIncidents(projectId);

  return {
    state: state.data,
    violations: violations.data ?? [],
    incidents: incidents.data ?? [],
    isLoading: state.isLoading || violations.isLoading || incidents.isLoading,
  };
}
