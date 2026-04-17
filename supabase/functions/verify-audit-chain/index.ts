// Phase 4 — admin-only audit chain verifier.
// Runs `verify_audit_chain` SQL function and returns broken rows (if any).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // User-scoped client (so SECURITY DEFINER fn can check has_role(auth.uid()))
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: authErr } = await supabaseUser.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit ?? 5000), 50000);

    const { data: broken, error } = await supabaseUser.rpc("verify_audit_chain", { p_limit: limit });
    if (error) {
      const status = error.message?.includes("admin only") ? 403 : 500;
      return new Response(JSON.stringify({ error: error.message }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role count for total inspected rows
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { count: total } = await supabaseAdmin
      .from("audit_logs").select("id", { count: "exact", head: true });

    return new Response(
      JSON.stringify({
        verified_at: new Date().toISOString(),
        rows_inspected: Math.min(Number(total ?? 0), limit),
        total_rows: total ?? 0,
        broken: broken ?? [],
        intact: (broken ?? []).length === 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
