import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Feature flag hook.
 * Queries the feature_flags table if it exists, otherwise defaults to false.
 * Gracefully handles missing table without console errors.
 */
export function useFeatureFlag(key: string): boolean {
  const { data } = useQuery({
    queryKey: ["feature_flags", key],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("feature_flags" as any)
          .select("enabled")
          .eq("key", key)
          .maybeSingle();
        if (error) return false;
        return (data as any)?.enabled ?? false;
      } catch {
        return false;
      }
    },
    staleTime: 60_000,
    refetchInterval: 300_000,
    retry: false,
  });
  return data ?? false;
}
