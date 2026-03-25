import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useScript(episodeId: string | undefined) {
  return useQuery({
    queryKey: ["script", episodeId],
    queryFn: async () => {
      if (!episodeId) return null;
      const { data, error } = await (supabase as any)
        .from("scripts")
        .select("*, versions:script_versions(*)")
        .eq("episode_id", episodeId)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data as any;
    },
    enabled: !!episodeId,
  });
}

export function useCreateScriptVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ episodeId, content, changeSummary }: {
      episodeId: string; content: string; changeSummary?: string;
    }) => {
      let { data: script } = await (supabase as any)
        .from("scripts")
        .select("id, current_version")
        .eq("episode_id", episodeId)
        .single();

      if (!script) {
        const { data: newScript, error: createError } = await (supabase as any)
          .from("scripts")
          .insert({ episode_id: episodeId, current_version: 1 })
          .select()
          .single();
        if (createError) throw createError;
        script = newScript;
      }

      const newVersion = (script.current_version ?? 0) + 1;
      const { data: version, error: versionError } = await (supabase as any)
        .from("script_versions")
        .insert({ script_id: script.id, version: newVersion, content, change_summary: changeSummary })
        .select()
        .single();
      if (versionError) throw versionError;

      await (supabase as any)
        .from("scripts")
        .update({ current_version: newVersion })
        .eq("id", script.id);

      return version;
    },
    onSuccess: (_data: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["script", variables.episodeId] });
    },
  });
}
