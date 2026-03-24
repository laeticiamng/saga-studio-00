import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useWorkflowRun(episodeId: string | undefined) {
  return useQuery({
    queryKey: ["workflow_run", episodeId],
    enabled: !!episodeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_runs")
        .select("*")
        .eq("episode_id", episodeId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useWorkflowSteps(workflowRunId: string | undefined) {
  return useQuery({
    queryKey: ["workflow_steps", workflowRunId],
    enabled: !!workflowRunId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_steps")
        .select("*")
        .eq("workflow_run_id", workflowRunId!)
        .order("step_order");
      if (error) throw error;
      return data;
    },
  });
}

export function useConfidenceScores(episodeId: string | undefined) {
  return useQuery({
    queryKey: ["confidence_scores", episodeId],
    enabled: !!episodeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_confidence_scores")
        .select("*")
        .eq("episode_id", episodeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useStartAutopilot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ episodeId }: { episodeId: string }) => {
      const { data, error } = await supabase.functions.invoke("autopilot-run", {
        body: { episode_id: episodeId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { episodeId }) => {
      queryClient.invalidateQueries({ queryKey: ["workflow_run", episodeId] });
      queryClient.invalidateQueries({ queryKey: ["episode", episodeId] });
    },
  });
}

export function useApprovalEvaluate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ episodeId, stepName, decision, reason }: {
      episodeId: string;
      stepName: string;
      decision: "approved" | "rejected" | "revision_requested";
      reason?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("approval-evaluate", {
        body: { episode_id: episodeId, step_name: stepName, decision, reason },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { episodeId }) => {
      queryClient.invalidateQueries({ queryKey: ["workflow_run", episodeId] });
      queryClient.invalidateQueries({ queryKey: ["workflow_steps"] });
      queryClient.invalidateQueries({ queryKey: ["approval_steps", episodeId] });
      queryClient.invalidateQueries({ queryKey: ["episode", episodeId] });
    },
  });
}

export function usePauseWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ workflowRunId }: { workflowRunId: string }) => {
      const { data, error } = await supabase.functions.invoke("workflow-pause", {
        body: { workflow_run_id: workflowRunId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow_run"] });
    },
  });
}

export function useResumeWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ workflowRunId, fromStep }: { workflowRunId: string; fromStep?: string }) => {
      const { data, error } = await supabase.functions.invoke("workflow-resume", {
        body: { workflow_run_id: workflowRunId, from_step: fromStep },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow_run"] });
    },
  });
}

export function useCancelWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ workflowRunId, reason }: { workflowRunId: string; reason?: string }) => {
      const { data, error } = await supabase.functions.invoke("workflow-cancel-safe", {
        body: { workflow_run_id: workflowRunId, reason },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow_run"] });
    },
  });
}
