import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

export function useCharacterProfiles(seriesId: string | undefined) {
  return useQuery({
    queryKey: ["character_profiles", seriesId],
    queryFn: async () => {
      if (!seriesId) return [];
      const { data, error } = await supabase
        .from("character_profiles")
        .select("*")
        .eq("series_id", seriesId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!seriesId,
  });
}

export function useCharacterProfile(characterId: string | undefined) {
  return useQuery({
    queryKey: ["character_profile", characterId],
    queryFn: async () => {
      if (!characterId) return null;
      const { data, error } = await supabase
        .from("character_profiles")
        .select(`
          *,
          reference_packs:character_reference_packs(*)
        `)
        .eq("id", characterId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!characterId,
  });
}

export function useCreateCharacterProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TablesInsert<"character_profiles">) => {
      const { data, error } = await supabase
        .from("character_profiles")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["character_profiles", data.series_id] });
    },
  });
}

export function useUpdateCharacterProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Partial<TablesInsert<"character_profiles">>) => {
      const { data, error } = await supabase
        .from("character_profiles")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["character_profiles", data.series_id] });
      queryClient.invalidateQueries({ queryKey: ["character_profile", data.id] });
    },
  });
}
