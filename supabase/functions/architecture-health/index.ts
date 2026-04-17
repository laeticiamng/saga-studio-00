// Architecture health — exposes the snapshot view + rich breakdowns for admins.
// Phase 3 additions: secrets readiness check, conflict resolution stats.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-correlation-id",
};

// Secret keys to check at boot. `required=true` means production cannot run without it.
const SECRET_REGISTRY: Array<{ key: string; required: boolean; category: string }> = [
  { key: "SUPABASE_URL", required: true, category: "infra" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", required: true, category: "infra" },
  { key: "SUPABASE_ANON_KEY", required: true, category: "infra" },
  { key: "LOVABLE_API_KEY", required: true, category: "ai" },
  { key: "OPENAI_API_KEY", required: false, category: "ai" },
  { key: "RUNWAY_API_KEY", required: false, category: "video" },
  { key: "LUMA_API_KEY", required: false, category: "video" },
  { key: "GOOGLE_VEO_API_KEY", required: false, category: "video" },
  { key: "STRIPE_SECRET_KEY", required: false, category: "payments" },
  { key: "STRIPE_WEBHOOK_SECRET", required: false, category: "payments" },
  { key: "RESEND_API_KEY", required: false, category: "email" },
  { key: "FFMPEG_RENDER_SERVICE_URL", required: false, category: "render" },
  { key: "SUPABASE_PUBLISHABLE_KEY", required: false, category: "infra" },
];

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
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userData.user.id, _role: "admin",
  });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Admin only" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: snapshot, error: snapErr } = await supabase
    .from("architecture_health_snapshot").select("*").single();
  if (snapErr) {
    return new Response(JSON.stringify({ error: snapErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: stuckAgents } = await supabase
    .from("agent_runs")
    .select("id, agent_slug, status, started_at, episode_id, chain_depth, correlation_id")
    .in("status", ["running", "queued"])
    .lt("started_at", new Date(Date.now() - 15 * 60_000).toISOString())
    .limit(20);

  const { data: reaperRuns } = await supabase
    .from("reaper_runs").select("*").order("started_at", { ascending: false }).limit(10);

  const { data: violations } = await supabase
    .from("budget_violations").select("*").order("created_at", { ascending: false }).limit(20);

  const { data: rules } = await supabase
    .from("forbidden_transitions").select("*").order("domain");

  const { data: dlqJobs } = await supabase
    .from("dead_letter_jobs").select("*").order("completed_at", { ascending: false }).limit(50);

  const { data: policies } = await supabase
    .from("governance_policies")
    .select("id, policy_key, domain, description, enforcement_mode, is_active")
    .eq("is_active", true).order("domain");

  const { data: deepChainAgents } = await supabase
    .from("agent_runs")
    .select("id, agent_slug, chain_depth, episode_id, created_at, correlation_id")
    .gt("chain_depth", 10).order("chain_depth", { ascending: false }).limit(10);

  // Phase 3: secrets readiness
  const secrets = SECRET_REGISTRY.map((s) => ({
    key: s.key,
    required: s.required,
    category: s.category,
    status: Deno.env.get(s.key) ? "ok" : "missing",
  }));
  const missingRequired = secrets.filter((s) => s.required && s.status === "missing");

  // Phase 3: conflict resolution stats
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
  const { count: conflictsAuto7d } = await supabase
    .from("conflict_resolution_log")
    .select("id", { count: "exact", head: true })
    .gte("created_at", sevenDaysAgo);
  const { count: conflictsPending } = await supabase
    .from("canonical_conflicts")
    .select("id", { count: "exact", head: true })
    .is("resolved_at", null);

  // Health score computation
  const s = snapshot as Record<string, number | string | null>;
  const stuck = (Number(s.agent_runs_stuck) || 0) + (Number(s.workflow_runs_stuck) || 0) + (Number(s.exports_stuck) || 0);
  const docsLegacyRatio = s.docs_total ? Number(s.docs_legacy) / Number(s.docs_total) : 0;
  const dlqCount = dlqJobs?.length ?? 0;
  const deepChains = deepChainAgents?.length ?? 0;

  let healthScore = 100;
  if (stuck > 0) healthScore -= Math.min(stuck * 5, 30);
  if (docsLegacyRatio > 0.5) healthScore -= 20;
  else if (docsLegacyRatio > 0.2) healthScore -= 10;
  if (Number(s.errors_7d) > 10) healthScore -= 15;
  if (Number(s.budget_blocks_7d) > 0) healthScore -= 10;
  if (Number(s.docs_failed) > 0) healthScore -= 10;
  if (dlqCount > 5) healthScore -= 10;
  if (deepChains > 0) healthScore -= 5;
  if (missingRequired.length > 0) healthScore -= 25; // P3.5: hard penalty
  healthScore = Math.max(0, healthScore);

  return new Response(JSON.stringify({
    snapshot,
    health_score: healthScore,
    stuck_agents: stuckAgents ?? [],
    reaper_runs: reaperRuns ?? [],
    budget_violations: violations ?? [],
    transition_rules: rules ?? [],
    dlq_jobs: dlqJobs ?? [],
    policies: policies ?? [],
    deep_chain_agents: deepChainAgents ?? [],
    secrets,
    secrets_missing_required: missingRequired.length,
    conflict_stats: {
      auto_resolved_7d: conflictsAuto7d ?? 0,
      pending: conflictsPending ?? 0,
    },
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
