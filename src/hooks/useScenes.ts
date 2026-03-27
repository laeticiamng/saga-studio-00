import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Scene = Database["public"]["Tables"]["scenes"]["Row"];
type SceneInsert = Database["public"]["Tables"]["scenes"]["Insert"];

export function useScenes(episodeId: string | undefined) {
  return useQuery({
    queryKey: ["scenes", episodeId],
    queryFn: async () => {
      if (!episodeId) return [];
      const { data, error } = await supabase
        .from("scenes")
        .select("*")
        .eq("episode_id", episodeId)
        .order("idx", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!episodeId,
  });
}

export function useCreateScene() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SceneInsert) => {
      const { data, error } = await supabase
        .from("scenes")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["scenes", data.episode_id] });
    },
  });
}

export function useUpdateScene() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Scene>) => {
      const { data, error } = await supabase
        .from("scenes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["scenes", data.episode_id] });
    },
  });
}
