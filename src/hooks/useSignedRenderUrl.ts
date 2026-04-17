import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves a private `renders` bucket file into a signed URL valid 24h.
 * Cached for 23h client-side to minimize edge calls.
 *
 * Pass either `path` (preferred) or fall back to a public URL for legacy rows.
 */
export function useSignedRenderUrl(opts: {
  path: string | null | undefined;
  projectId: string | null | undefined;
  fallbackUrl?: string | null;
}) {
  const { path, projectId, fallbackUrl } = opts;
  const enabled = !!(path && projectId);

  const query = useQuery({
    queryKey: ["signed-render-url", projectId, path],
    enabled,
    staleTime: 23 * 60 * 60 * 1000, // 23h
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("sign-render-url", {
        body: { path, project_id: projectId },
      });
      if (error) throw error;
      return data as { url: string; expires_in: number; expires_at: string };
    },
  });

  return {
    url: query.data?.url ?? fallbackUrl ?? null,
    isLoading: enabled && query.isLoading,
    error: query.error,
  };
}
