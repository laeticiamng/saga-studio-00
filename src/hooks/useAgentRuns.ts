import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAgentRuns(options: { episodeId?: string; seriesId?: string }) {
  const { episodeId, seriesId } = options;
  return useQuery({
    queryKey: ["agent_runs", { episodeId, seriesId }],
    queryFn: async () => {
      let query = (supabase as any)
        .from("agent_runs")
        .select("*, agent:agent_registry!agent_runs_agent_slug_fkey(name, category, role)")
        .order("created_at", { ascending: false });
      if (episodeId) query = query.eq("episode_id", episodeId);
      if (seriesId) query = query.eq("series_id", seriesId);
      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!(episodeId || seriesId),
    refetchInterval: 10_000,
  });
}

export function useAgentRegistry() {
  return useQuery({
    queryKey: ["agent_registry"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("agent_registry")
        .select("*")
        .order("category", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    staleTime: 300_000,
  });
}
