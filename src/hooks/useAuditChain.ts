import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuditChainResult {
  verified_at: string;
  rows_inspected: number;
  total_rows: number;
  broken: Array<{
    broken_id: string;
    expected_hash: string;
    actual_hash: string;
    chain_position: number;
  }>;
  intact: boolean;
}

export function useAuditChain() {
  return useMutation<AuditChainResult, Error, number | undefined>({
    mutationFn: async (limit) => {
      const { data, error } = await supabase.functions.invoke("verify-audit-chain", {
        body: { limit: limit ?? 5000 },
      });
      if (error) throw error;
      return data as AuditChainResult;
    },
  });
}

// Renderer fallback observability (admin-only RLS)
export interface RendererFallbackState {
  external_healthy: boolean;
  consecutive_failures: number;
  last_check_at: string;
  last_failure_at: string | null;
  fallback_active: boolean;
  notes: string | null;
}

export function useRendererFallback() {
  return useQuery<RendererFallbackState | null>({
    queryKey: ["renderer-fallback"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("renderer_fallback_state")
        .select("external_healthy, consecutive_failures, last_check_at, last_failure_at, fallback_active, notes")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
  });
}
