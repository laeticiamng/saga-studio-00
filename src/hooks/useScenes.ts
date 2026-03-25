import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useScenes(episodeId: string | undefined) {
  return useQuery({
    queryKey: ["scenes", episodeId],
    queryFn: async () => {
      if (!episodeId) return [];
      const { data, error } = await (supabase as any)
        .from("scenes")
        .select("*")
        .eq("episode_id", episodeId)
        .order("idx", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!episodeId,
  });
}

export function useCreateScene() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: any) => {
      const { data, error } = await (supabase as any)
        .from("scenes")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["scenes", data.episode_id] });
    },
  });
}

export function useUpdateScene() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { data, error } = await (supabase as any)
        .from("scenes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["scenes", data.episode_id] });
    },
  });
}
