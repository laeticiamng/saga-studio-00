import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useProjectBudget(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project_budget", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("project_budgets")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
}

export function useUpsertProjectBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      project_id: string;
      budget_limit_credits?: number;
      cost_mode?: string;
      per_scene_limit_credits?: number;
    }) => {
      const { data, error } = await supabase
        .from("project_budgets")
        .upsert(input, { onConflict: "project_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["project_budget", data.project_id] });
    },
  });
}
