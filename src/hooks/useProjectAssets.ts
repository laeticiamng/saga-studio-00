import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useProjectAssets(projectId: string | undefined, assetType?: string) {
  return useQuery({
    queryKey: ["project_assets", projectId, assetType],
    queryFn: async () => {
      if (!projectId) return [];
      let q = supabase.from("project_assets").select("*").eq("project_id", projectId);
      if (assetType) q = q.eq("asset_type", assetType);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
}

export function useCreateProjectAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      project_id: string;
      asset_type: string;
      source_provider?: string;
      source_model?: string;
      url?: string;
      storage_path?: string;
      metadata?: Record<string, unknown>;
      tags?: string[];
    }) => {
      const { data, error } = await supabase.from("project_assets").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["project_assets", data.project_id] });
    },
  });
}
