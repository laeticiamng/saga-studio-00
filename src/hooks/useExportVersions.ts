import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useExportVersions(projectId: string | undefined) {
  return useQuery({
    queryKey: ["export_versions", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("export_versions")
        .select("*")
        .eq("project_id", projectId)
        .order("version", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
}

export function useCreateExportVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      project_id: string;
      timeline_id?: string;
      episode_id?: string;
      format?: string;
      resolution?: string;
      aspect_ratio?: string;
      look_preset?: string;
    }) => {
      // Auto-increment version
      const { data: existing } = await supabase
        .from("export_versions")
        .select("version")
        .eq("project_id", input.project_id)
        .order("version", { ascending: false })
        .limit(1);
      const nextVersion = (existing?.[0]?.version ?? 0) + 1;
      
      const { data, error } = await supabase
        .from("export_versions")
        .insert({ ...input, version: nextVersion })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["export_versions", data.project_id] });
    },
  });
}
