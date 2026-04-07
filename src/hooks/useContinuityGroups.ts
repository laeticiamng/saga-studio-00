import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useContinuityGroups(projectId?: string, seriesId?: string) {
  return useQuery({
    queryKey: ["continuity_groups", projectId, seriesId],
    queryFn: async () => {
      let q = supabase.from("continuity_groups").select("*");
      if (projectId) q = q.eq("project_id", projectId);
      if (seriesId) q = q.eq("series_id", seriesId);
      const { data, error } = await q.order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!(projectId || seriesId),
  });
}

export function useCreateContinuityGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { project_id?: string; series_id?: string; name: string; description?: string }) => {
      const { data, error } = await supabase.from("continuity_groups").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["continuity_groups"] });
    },
  });
}
