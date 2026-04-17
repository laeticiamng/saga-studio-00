// Architecture health — exposes the snapshot view + rich breakdowns for admins.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const authHeader = req.headers.get("Authorization") ?? "";
  const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Admin only" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Snapshot
  const { data: snapshot, error: snapErr } = await supabase
    .from("architecture_health_snapshot")
    .select("*")
    .single();
  if (snapErr) {
    return new Response(JSON.stringify({ error: snapErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Stuck jobs detail
  const { data: stuckAgents } = await supabase
    .from("agent_runs")
    .select("id, agent_slug, status, started_at, episode_id")
    .in("status", ["running", "queued"])
    .lt("started_at", new Date(Date.now() - 15 * 60_000).toISOString())
    .limit(20);

  // Recent reaper runs
  const { data: reaperRuns } = await supabase
    .from("reaper_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(10);

  // Recent budget violations
  const { data: violations } = await supabase
    .from("budget_violations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  // Forbidden transitions config
  const { data: rules } = await supabase
    .from("forbidden_transitions")
    .select("*")
    .order("domain");

  // Compute health score (0-100)
  const s = snapshot as Record<string, number | string | null>;
  const stuck = (Number(s.agent_runs_stuck) || 0) + (Number(s.workflow_runs_stuck) || 0) + (Number(s.exports_stuck) || 0);
  const docsLegacyRatio = s.docs_total ? Number(s.docs_legacy) / Number(s.docs_total) : 0;

  let healthScore = 100;
  if (stuck > 0) healthScore -= Math.min(stuck * 5, 30);
  if (docsLegacyRatio > 0.5) healthScore -= 20;
  else if (docsLegacyRatio > 0.2) healthScore -= 10;
  if (Number(s.errors_7d) > 10) healthScore -= 15;
  if (Number(s.budget_blocks_7d) > 0) healthScore -= 10;
  if (Number(s.docs_failed) > 0) healthScore -= 10;
  healthScore = Math.max(0, healthScore);

  return new Response(
    JSON.stringify({
      snapshot,
      health_score: healthScore,
      stuck_agents: stuckAgents ?? [],
      reaper_runs: reaperRuns ?? [],
      budget_violations: violations ?? [],
      transition_rules: rules ?? [],
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
