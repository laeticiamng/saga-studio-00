import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSceneClipCandidates(projectId: string | undefined, sceneId?: string) {
  return useQuery({
    queryKey: ["scene_clip_candidates", projectId, sceneId],
    queryFn: async () => {
      if (!projectId) return [];
      let q = supabase.from("scene_clip_candidates").select("*").eq("project_id", projectId);
      if (sceneId) q = q.eq("scene_id", sceneId);
      const { data, error } = await q.order("rank", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
}

export function useUpdateCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { data, error } = await supabase.from("scene_clip_candidates").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["scene_clip_candidates", data.project_id] });
    },
  });
}
