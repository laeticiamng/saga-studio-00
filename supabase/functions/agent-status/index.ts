import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const episodeId = url.searchParams.get("episode_id");
    const seriesId = url.searchParams.get("series_id");

    if (!episodeId && !seriesId) {
      throw new Error("episode_id or series_id required");
    }

    let query = supabase
      .from("agent_runs")
      .select(`
        *,
        agent:agent_registry!agent_runs_agent_slug_fkey(name, category, role, description),
        outputs:agent_outputs(id, output_type, content)
      `)
      .order("created_at", { ascending: false })
      .limit(50);

    if (episodeId) query = query.eq("episode_id", episodeId);
    if (seriesId) query = query.eq("series_id", seriesId);

    const { data: runs, error } = await query;
    if (error) throw error;

    // Compute summary stats
    const summary = {
      total: runs?.length || 0,
      queued: runs?.filter(r => r.status === "queued").length || 0,
      running: runs?.filter(r => r.status === "running").length || 0,
      completed: runs?.filter(r => r.status === "completed").length || 0,
      failed: runs?.filter(r => r.status === "failed").length || 0,
      total_cost_credits: runs?.reduce((sum, r) => sum + (r.cost_credits || 0), 0) || 0,
      total_tokens: runs?.reduce((sum, r) => sum + (r.tokens_used || 0), 0) || 0,
      avg_latency_ms: runs && runs.length > 0
        ? Math.round(runs.reduce((sum, r) => sum + (r.latency_ms || 0), 0) / runs.length)
        : 0,
    };

    return new Response(JSON.stringify({ runs, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
