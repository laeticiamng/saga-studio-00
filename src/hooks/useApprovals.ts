import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useApprovalSteps(episodeId: string | undefined) {
  return useQuery({
    queryKey: ["approval_steps", episodeId],
    queryFn: async () => {
      if (!episodeId) return [];
      const { data, error } = await supabase
        .from("approval_steps")
        .select(`
          *,
          decisions:approval_decisions(*)
        `)
        .eq("episode_id", episodeId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!episodeId,
  });
}

export function useUpdateApprovalStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
    }: {
      id: string;
      status: "approved" | "rejected" | "revision_requested";
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("approval_steps")
        .update({ status, notes })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["approval_steps", data.episode_id] });
    },
  });
}
