import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves a private `renders` bucket file into a signed URL valid 24h.
 * Cached for 23h client-side to minimize edge calls.
 *
 * - Authenticated context: uses `sign-render-url` (verifies ownership).
 * - Public/share context: pass `mode: "public"` to use `sign-share-url` (verifies projects_public).
 * - For legacy rows that only have a public URL (pre-privatization), pass `fallbackUrl`.
 */
export function useSignedRenderUrl(opts: {
  path: string | null | undefined;
  projectId: string | null | undefined;
  fallbackUrl?: string | null;
  mode?: "authenticated" | "public";
}) {
  const { path, projectId, fallbackUrl, mode = "authenticated" } = opts;
  const enabled = !!(path && projectId);
  const fnName = mode === "public" ? "sign-share-url" : "sign-render-url";

  const query = useQuery({
    queryKey: ["signed-render-url", mode, projectId, path],
    enabled,
    staleTime: 23 * 60 * 60 * 1000, // 23h
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(fnName, {
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
