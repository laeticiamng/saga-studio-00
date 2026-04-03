import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useContinuityNodes(seriesId: string | undefined) {
  return useQuery({
    queryKey: ["continuity_nodes", seriesId],
    enabled: !!seriesId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("continuity_memory_nodes")
        .select("*")
        .eq("series_id", seriesId!)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useContinuityEdges(seriesId: string | undefined) {
  return useQuery({
    queryKey: ["continuity_edges", seriesId],
    enabled: !!seriesId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("continuity_memory_edges")
        .select("*, source:continuity_memory_nodes!continuity_memory_edges_source_node_id_fkey(label, node_type), target:continuity_memory_nodes!continuity_memory_edges_target_node_id_fkey(label, node_type)")
        .eq("series_id", seriesId!);
      if (error) throw error;
      return data;
    },
  });
}

export function useContinuityConflicts(seriesId: string | undefined, episodeId?: string) {
  return useQuery({
    queryKey: ["continuity_conflicts", seriesId, episodeId],
    enabled: !!seriesId,
    queryFn: async () => {
      let query = supabase
        .from("continuity_conflicts")
        .select("*")
        .eq("series_id", seriesId!)
        .order("created_at", { ascending: false });
      if (episodeId) query = query.eq("episode_id", episodeId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useDeliveryManifests(seriesId: string | undefined) {
  return useQuery({
    queryKey: ["delivery_manifests", seriesId],
    enabled: !!seriesId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_manifests")
        .select("*")
        .eq("series_id", seriesId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useQCReports(episodeId: string | undefined) {
  return useQuery({
    queryKey: ["qc_reports", episodeId],
    enabled: !!episodeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qc_reports")
        .select("*")
        .eq("episode_id", episodeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useResolveConflict() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, resolution }: { id: string; resolution: string }) => {
      const { data, error } = await supabase
        .from("continuity_conflicts")
        .update({ resolved: true, resolution, resolved_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["continuity_conflicts", data.series_id] });
    },
  });
}

export function useCreateContinuityNode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { series_id: string; node_type: string; label: string; properties?: Record<string, unknown> }) => {
      const { data, error } = await supabase
        .from("continuity_memory_nodes")
        .insert({ ...input, is_active: true })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["continuity_nodes", data.series_id] });
    },
  });
}

export function useExportJobs(seriesId: string | undefined) {
  return useQuery({
    queryKey: ["export_jobs", seriesId],
    enabled: !!seriesId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("export_jobs")
        .select("*")
        .eq("series_id", seriesId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
