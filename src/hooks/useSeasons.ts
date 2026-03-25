import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSeasons(seriesId: string | undefined) {
  return useQuery({
    queryKey: ["seasons", seriesId],
    queryFn: async () => {
      if (!seriesId) return [];
      const { data, error } = await (supabase as any)
        .from("seasons")
        .select("*")
        .eq("series_id", seriesId)
        .order("number", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!seriesId,
  });
}

export function useSeason(seasonId: string | undefined) {
  return useQuery({
    queryKey: ["season", seasonId],
    queryFn: async () => {
      if (!seasonId) return null;
      const { data, error } = await (supabase as any)
        .from("seasons")
        .select("*")
        .eq("id", seasonId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!seasonId,
  });
}

export function useCreateSeason() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: any) => {
      const { data, error } = await (supabase as any)
        .from("seasons")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["seasons", data.series_id] });
    },
  });
}

export function useUpdateSeason() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { data, error } = await (supabase as any)
        .from("seasons")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["seasons", data.series_id] });
      queryClient.invalidateQueries({ queryKey: ["season", data.id] });
    },
  });
}
