import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useTimelineTracks(timelineId: string | undefined) {
  return useQuery({
    queryKey: ["timeline_tracks", timelineId],
    queryFn: async () => {
      if (!timelineId) return [];
      const { data, error } = await supabase
        .from("timeline_tracks")
        .select("*")
        .eq("timeline_id", timelineId)
        .order("idx", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!timelineId,
  });
}

export function useCreateTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { timeline_id: string; track_type: string; idx: number; label: string }) => {
      const { data, error } = await supabase.from("timeline_tracks").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["timeline_tracks", data.timeline_id] });
    },
  });
}

export function useUpdateTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { data, error } = await supabase.from("timeline_tracks").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["timeline_tracks", data.timeline_id] });
    },
  });
}
