import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Season = Database["public"]["Tables"]["seasons"]["Row"];
type SeasonInsert = Database["public"]["Tables"]["seasons"]["Insert"];

export function useSeasons(seriesId: string | undefined) {
  return useQuery({
    queryKey: ["seasons", seriesId],
    queryFn: async () => {
      if (!seriesId) return [];
      const { data, error } = await supabase
        .from("seasons")
        .select("*")
        .eq("series_id", seriesId)
        .order("number", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!seriesId,
  });
}

export function useSeason(seasonId: string | undefined) {
  return useQuery({
    queryKey: ["season", seasonId],
    queryFn: async () => {
      if (!seasonId) return null;
      const { data, error } = await supabase
        .from("seasons")
        .select("*")
        .eq("id", seasonId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!seasonId,
  });
}

export function useCreateSeason() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SeasonInsert) => {
      const { data, error } = await supabase
        .from("seasons")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["seasons", data.series_id] });
    },
  });
}

export function useUpdateSeason() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Season>) => {
      const { data, error } = await supabase
        .from("seasons")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["seasons", data.series_id] });
      queryClient.invalidateQueries({ queryKey: ["season", data.id] });
    },
  });
}

export function useDeleteSeason() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, seriesId }: { id: string; seriesId: string }) => {
      const { error } = await supabase.from("seasons").delete().eq("id", id);
      if (error) throw error;
      return { seriesId };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["seasons", variables.seriesId] });
    },
  });
}
