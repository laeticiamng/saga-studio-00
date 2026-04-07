import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useTimelines(projectId: string | undefined, episodeId?: string) {
  return useQuery({
    queryKey: ["timelines", projectId, episodeId],
    queryFn: async () => {
      if (!projectId) return [];
      let q = supabase.from("timelines").select("*").eq("project_id", projectId);
      if (episodeId) q = q.eq("episode_id", episodeId);
      const { data, error } = await q.order("version", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
}

export function useTimeline(timelineId: string | undefined) {
  return useQuery({
    queryKey: ["timeline", timelineId],
    queryFn: async () => {
      if (!timelineId) return null;
      const { data, error } = await supabase.from("timelines").select("*").eq("id", timelineId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!timelineId,
  });
}

export function useCreateTimeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { project_id: string; episode_id?: string; name?: string; version?: number }) => {
      const { data, error } = await supabase.from("timelines").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["timelines", data.project_id] });
    },
  });
}

export function useUpdateTimeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { data, error } = await supabase.from("timelines").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["timeline", data.id] });
      qc.invalidateQueries({ queryKey: ["timelines", data.project_id] });
    },
  });
}
