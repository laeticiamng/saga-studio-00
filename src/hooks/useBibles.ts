import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, Database } from "@/integrations/supabase/types";

type BibleType = Database["public"]["Enums"]["bible_type"];

export function useBibles(seriesId: string | undefined, type?: BibleType) {
  return useQuery({
    queryKey: ["bibles", seriesId, type],
    queryFn: async () => {
      if (!seriesId) return [];
      let query = supabase
        .from("bibles")
        .select("*")
        .eq("series_id", seriesId)
        .order("name", { ascending: true });
      if (type) query = query.eq("type", type);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!seriesId,
  });
}

export function useCreateBible() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TablesInsert<"bibles">) => {
      const { data, error } = await supabase
        .from("bibles")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["bibles", data.series_id] });
    },
  });
}

export function useUpdateBible() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Partial<TablesInsert<"bibles">>) => {
      const { data, error } = await supabase
        .from("bibles")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["bibles", data.series_id] });
    },
  });
}

export function useDeleteBible() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, seriesId }: { id: string; seriesId: string }) => {
      const { error } = await supabase.from("bibles").delete().eq("id", id);
      if (error) throw error;
      return { seriesId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["bibles", data.seriesId] });
    },
  });
}
