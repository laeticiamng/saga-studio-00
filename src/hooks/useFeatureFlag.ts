import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useFeatureFlag(key: string): boolean {
  const { data } = useQuery({
    queryKey: ["feature_flags", key],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("feature_flags")
        .select("enabled")
        .eq("key", key)
        .single();
      if (error) return false;
      return data?.enabled ?? false;
    },
    staleTime: 60_000,
    refetchInterval: 300_000,
  });
  return data ?? false;
}
