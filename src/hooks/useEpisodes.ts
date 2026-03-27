import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Episode = Database["public"]["Tables"]["episodes"]["Row"];
type EpisodeInsert = Database["public"]["Tables"]["episodes"]["Insert"];

export function useEpisodes(seasonId: string | undefined) {
  return useQuery({
    queryKey: ["episodes", seasonId],
    queryFn: async () => {
      if (!seasonId) return [];
      const { data, error } = await supabase
        .from("episodes")
        .select("*")
        .eq("season_id", seasonId)
        .order("number", { ascending: true });
      if (error) throw error;
      return data as Episode[];
    },
    enabled: !!seasonId,
  });
}

export function useEpisode(episodeId: string | undefined) {
  return useQuery({
    queryKey: ["episode", episodeId],
    queryFn: async () => {
      if (!episodeId) return null;
      const { data, error } = await supabase
        .from("episodes")
        .select("*, season:seasons!episodes_season_id_fkey(id, number, title, series_id)")
        .eq("id", episodeId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!episodeId,
  });
}

export function useCreateEpisode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: EpisodeInsert) => {
      const { data, error } = await supabase
        .from("episodes")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["episodes", data.season_id] });
    },
  });
}

export function useUpdateEpisode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Episode>) => {
      const { data, error } = await supabase
        .from("episodes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["episodes", data.season_id] });
      queryClient.invalidateQueries({ queryKey: ["episode", data.id] });
    },
  });
}

export function useDeleteEpisode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, seasonId }: { id: string; seasonId: string }) => {
      const { error } = await supabase.from("episodes").delete().eq("id", id);
      if (error) throw error;
      return { seasonId };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["episodes", variables.seasonId] });
    },
  });
}
