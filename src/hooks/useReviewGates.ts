import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useReviewGates(projectId: string | undefined, episodeId?: string) {
  return useQuery({
    queryKey: ["review_gates", projectId, episodeId],
    queryFn: async () => {
      if (!projectId) return [];
      let q = supabase.from("review_gates").select("*").eq("project_id", projectId);
      if (episodeId) q = q.eq("episode_id", episodeId);
      const { data, error } = await q.order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
}

export function useCreateReviewGate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { project_id: string; episode_id?: string; scene_id?: string; gate_type: string }) => {
      const { data, error } = await supabase.from("review_gates").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["review_gates", data.project_id] });
    },
  });
}

export function useDecideReviewGate() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, action, notes }: { id: string; status: string; action?: string; notes?: string }) => {
      const { data, error } = await supabase
        .from("review_gates")
        .update({
          status,
          decision_action: action,
          decided_by: user?.id,
          decided_at: new Date().toISOString(),
          notes,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["review_gates", data.project_id] });
    },
  });
}
