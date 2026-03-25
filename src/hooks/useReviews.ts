import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePsychologyReviews(episodeId: string | undefined) {
  return useQuery({
    queryKey: ["psychology_reviews", episodeId],
    queryFn: async () => {
      if (!episodeId) return [];
      const { data, error } = await (supabase as any)
        .from("psychology_reviews")
        .select("*")
        .eq("episode_id", episodeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!episodeId,
  });
}

export function useLegalEthicsReviews(episodeId: string | undefined) {
  return useQuery({
    queryKey: ["legal_ethics_reviews", episodeId],
    queryFn: async () => {
      if (!episodeId) return [];
      const { data, error } = await (supabase as any)
        .from("legal_ethics_reviews")
        .select("*")
        .eq("episode_id", episodeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!episodeId,
  });
}

export function useContinuityReports(episodeId: string | undefined) {
  return useQuery({
    queryKey: ["continuity_reports", episodeId],
    queryFn: async () => {
      if (!episodeId) return [];
      const { data, error } = await (supabase as any)
        .from("continuity_reports")
        .select("*")
        .eq("episode_id", episodeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!episodeId,
  });
}
