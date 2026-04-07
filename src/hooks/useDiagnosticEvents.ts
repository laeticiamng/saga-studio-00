import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDiagnosticEvents(projectId: string | undefined, scope?: string) {
  return useQuery({
    queryKey: ["diagnostic_events", projectId, scope],
    queryFn: async () => {
      if (!projectId) return [];
      let q = supabase.from("diagnostic_events").select("*").eq("project_id", projectId);
      if (scope) q = q.eq("scope", scope);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
}
