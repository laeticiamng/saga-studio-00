import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useProviders() {
  return useQuery({
    queryKey: ["provider_registry"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_registry")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
}
