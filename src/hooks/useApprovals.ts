import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useApprovalSteps(episodeId: string | undefined) {
  return useQuery({
    queryKey: ["approval_steps", episodeId],
    queryFn: async () => {
      let query = supabase
        .from("approval_steps")
        .select("*, decisions:approval_decisions(*)")
        .order("created_at", { ascending: true });
      if (episodeId) query = query.eq("episode_id", episodeId);
      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data;
    },
  });
}

export function useApprovalStepsBySeries(seriesId: string | undefined) {
  return useQuery({
    queryKey: ["approval_steps_series", seriesId],
    enabled: !!seriesId,
    refetchInterval: 10_000,
    queryFn: async () => {
      if (!seriesId) return [];
      // Get all seasons for this series
      const { data: seasons } = await supabase
        .from("seasons")
        .select("id")
        .eq("series_id", seriesId);
      if (!seasons || seasons.length === 0) return [];
      // Get all episodes for those seasons
      const { data: episodes } = await supabase
        .from("episodes")
        .select("id, number, title, season_id")
        .in("season_id", seasons.map(s => s.id));
      if (!episodes || episodes.length === 0) return [];
      const episodeIds = episodes.map(e => e.id);
      const episodeMap = Object.fromEntries(episodes.map(e => [e.id, e]));
      // Get approval steps for those episodes
      const { data, error } = await supabase
        .from("approval_steps")
        .select("*, decisions:approval_decisions(*)")
        .in("episode_id", episodeIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(a => ({
        ...a,
        _episode: episodeMap[a.episode_id] || null,
      }));
    },
  });
}

export function useUpdateApprovalStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, notes }: {
      id: string; status: "approved" | "rejected" | "revision_requested"; notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("approval_steps")
        .update({ status, notes })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["approval_steps", data.episode_id] });
      queryClient.invalidateQueries({ queryKey: ["approval_steps", undefined] });
    },
  });
}
