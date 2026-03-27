import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type Series = Database["public"]["Tables"]["series"]["Row"];

export function useSeriesList() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["series", "list", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("series")
        .select("*, project:projects!series_project_id_fkey(id, title, status, style_preset, created_at, updated_at)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useSeries(seriesId: string | undefined) {
  return useQuery({
    queryKey: ["series", seriesId],
    queryFn: async () => {
      if (!seriesId) return null;
      const { data, error } = await supabase
        .from("series")
        .select("*, project:projects!series_project_id_fkey(id, title, status, style_preset, synopsis, created_at, updated_at)")
        .eq("id", seriesId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!seriesId,
  });
}

export function useSeriesByProjectId(projectId: string | undefined) {
  return useQuery({
    queryKey: ["series", "by-project", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("series")
        .select("*")
        .eq("project_id", projectId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
}

export function useCreateSeries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      title: string;
      logline?: string;
      genre?: string;
      tone?: string;
      target_audience?: string;
      total_seasons?: number;
      style_preset?: string;
      episode_duration_min?: number;
      episodes_per_season?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke("create-series", {
        body: input,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["series"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateSeries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Series>) => {
      const { data, error } = await supabase
        .from("series")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["series", data.id] });
      queryClient.invalidateQueries({ queryKey: ["series", "list"] });
    },
  });
}
