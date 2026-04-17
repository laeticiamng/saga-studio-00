// Shared rate-limit helper for edge functions.
// Backed by `consume_rate_limit` SECURITY DEFINER PG function.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface RateLimitOptions {
  endpoint: string;
  cost?: number;
  capacity?: number;
  refillPerMinute?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  capacity: number;
}

/**
 * Token bucket per (user, endpoint).
 * Returns { allowed: boolean, remaining, capacity }.
 *
 * Usage:
 *   const supabase = createClient(...);
 *   const r = await checkRateLimit(supabase, userId, { endpoint: 'autopilot-run', cost: 1, capacity: 30, refillPerMinute: 10 });
 *   if (!r.allowed) return new Response('Rate limited', { status: 429 });
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const { endpoint, cost = 1, capacity = 60, refillPerMinute = 30 } = opts;
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_user_id: userId,
    p_endpoint: endpoint,
    p_cost: cost,
    p_capacity: capacity,
    p_refill_per_minute: refillPerMinute,
  });
  if (error) {
    // Fail open on infra error to avoid blocking legitimate users.
    console.error("[rate-limit] error:", error.message);
    return { allowed: true, remaining: capacity, capacity };
  }
  const r = data as RateLimitResult;
  return r;
}

export function rateLimitResponse(r: RateLimitResult, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded",
      remaining: r.remaining,
      capacity: r.capacity,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": "60",
      },
    },
  );
}

// Re-export for convenience
export { createClient };
