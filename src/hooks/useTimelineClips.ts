import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useTimelineClips(trackIds: string[]) {
  return useQuery({
    queryKey: ["timeline_clips", trackIds],
    queryFn: async () => {
      if (!trackIds.length) return [];
      const { data, error } = await supabase
        .from("timeline_clips")
        .select("*")
        .in("track_id", trackIds)
        .order("start_time_ms", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: trackIds.length > 0,
  });
}

export function useCreateClip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      track_id: string;
      start_time_ms: number;
      end_time_ms: number;
      source_url?: string;
      scene_id?: string;
      episode_shot_id?: string;
      name?: string;
      provider?: string;
      model?: string;
    }) => {
      const { data, error } = await supabase.from("timeline_clips").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["timeline_clips"] });
    },
  });
}

export function useUpdateClip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { data, error } = await supabase.from("timeline_clips").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timeline_clips"] });
    },
  });
}

export function useDeleteClip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("timeline_clips").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timeline_clips"] });
    },
  });
}
