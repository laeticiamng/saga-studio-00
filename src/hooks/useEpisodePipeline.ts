import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAdvanceEpisode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ episodeId }: { episodeId: string }) => {
      const { data, error } = await supabase.functions.invoke("episode-pipeline", {
        body: { episode_id: episodeId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["episode", variables.episodeId] });
      queryClient.invalidateQueries({ queryKey: ["agent_runs"] });
    },
  });
}
