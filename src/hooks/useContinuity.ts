import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useContinuityNodes(seriesId: string | undefined) {
  return useQuery({
    queryKey: ["continuity_nodes", seriesId],
    enabled: !!seriesId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("continuity_memory_nodes")
        .select("*")
        .eq("series_id", seriesId!)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useContinuityEdges(seriesId: string | undefined) {
  return useQuery({
    queryKey: ["continuity_edges", seriesId],
    enabled: !!seriesId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("continuity_memory_edges")
        .select("*, source:continuity_memory_nodes!continuity_memory_edges_source_node_id_fkey(label, node_type), target:continuity_memory_nodes!continuity_memory_edges_target_node_id_fkey(label, node_type)")
        .eq("series_id", seriesId!);
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useContinuityConflicts(seriesId: string | undefined, episodeId?: string) {
  return useQuery({
    queryKey: ["continuity_conflicts", seriesId, episodeId],
    enabled: !!seriesId,
    queryFn: async () => {
      let query = (supabase as any)
        .from("continuity_conflicts")
        .select("*")
        .eq("series_id", seriesId!)
        .order("created_at", { ascending: false });
      if (episodeId) query = query.eq("episode_id", episodeId);
      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useDeliveryManifests(seriesId: string | undefined) {
  return useQuery({
    queryKey: ["delivery_manifests", seriesId],
    enabled: !!seriesId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("delivery_manifests")
        .select("*")
        .eq("series_id", seriesId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useQCReports(episodeId: string | undefined) {
  return useQuery({
    queryKey: ["qc_reports", episodeId],
    enabled: !!episodeId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("qc_reports")
        .select("*")
        .eq("episode_id", episodeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useExportJobs(seriesId: string | undefined) {
  return useQuery({
    queryKey: ["export_jobs", seriesId],
    enabled: !!seriesId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("export_jobs")
        .select("*")
        .eq("series_id", seriesId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}
