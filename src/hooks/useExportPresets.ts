import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useExportPresets() {
  return useQuery({
    queryKey: ["export_presets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("export_presets")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}
