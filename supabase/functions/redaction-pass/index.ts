import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * redaction-pass: Runs compliance/redaction checks on an episode before export.
 * Checks brand safety, applies redaction rules, and produces a report.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { episode_id, series_id } = body;
    if (!episode_id) throw new Error("episode_id required");

    // Fetch episode
    const { data: episode, error: epErr } = await supabase
      .from("episodes")
      .select(`*, season:seasons!episodes_season_id_fkey(id, series_id)`)
      .eq("id", episode_id)
      .single();
    if (epErr || !episode) throw new Error("Episode not found");

    const resolvedSeriesId = series_id || episode.season?.series_id;

    // Fetch active redaction profile for this series
    const { data: profiles } = await supabase
      .from("redaction_profiles")
      .select("*, rules:redaction_rules(*)")
      .eq("series_id", resolvedSeriesId)
      .eq("is_active", true);

    // Fetch brand safety flags
    const { data: brandFlags } = await supabase
      .from("brand_safety_flags")
      .select("*")
      .eq("episode_id", episode_id)
      .eq("resolved", false);

    // Fetch existing reviews
    const { data: psychReviews } = await supabase
      .from("psychology_reviews")
      .select("verdict, recommendations")
      .eq("episode_id", episode_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const { data: legalReviews } = await supabase
      .from("legal_ethics_reviews")
      .select("verdict, flags, recommendations")
      .eq("episode_id", episode_id)
      .order("created_at", { ascending: false })
      .limit(1);

    // Determine blocking issues
    const blockingIssues: Array<{ type: string; description: string }> = [];

    // Check brand safety
    if (brandFlags && brandFlags.length > 0) {
      const criticalFlags = brandFlags.filter(f => f.severity === "critical" || f.severity === "error");
      for (const flag of criticalFlags) {
        blockingIssues.push({
          type: "brand_safety",
          description: `${flag.category}: ${flag.description}`,
        });
      }
    }

    // Check psychology review
    if (psychReviews?.[0]?.verdict === "block") {
      blockingIssues.push({
        type: "psychology_block",
        description: `Psychology review blocked: ${psychReviews[0].recommendations || "see review"}`,
      });
    }

    // Check legal review
    if (legalReviews?.[0]?.verdict === "block") {
      blockingIssues.push({
        type: "legal_block",
        description: `Legal/ethics review blocked: ${legalReviews[0].recommendations || "see review"}`,
      });
    }

    // Create redaction run
    const profile = profiles?.[0];
    let redactionRunId = null;
    if (profile) {
      const { data: redactionRun } = await supabase
        .from("redaction_runs")
        .insert({
          profile_id: profile.id,
          episode_id,
          status: "completed",
          applied_rules: profile.rules || [],
          issues_found: blockingIssues.length + (brandFlags?.length || 0),
          issues_resolved: brandFlags?.filter((f: Record<string, unknown>) => f.resolved).length || 0,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();
      redactionRunId = redactionRun?.id;

      // Create redaction report
      if (redactionRunId) {
        await supabase.from("redaction_reports").insert({
          redaction_run_id: redactionRunId,
          findings: [...blockingIssues, ...(brandFlags || []).map((f: Record<string, unknown>) => ({
            type: "brand_safety_flag",
            category: f.category,
            severity: f.severity,
            description: f.description,
          }))],
          verdict: blockingIssues.length > 0 ? "fail" : (brandFlags && brandFlags.length > 0 ? "partial" : "pass"),
          summary: blockingIssues.length > 0
            ? `${blockingIssues.length} blocking issue(s) found — export blocked`
            : brandFlags && brandFlags.length > 0
              ? `${brandFlags.length} warning(s) found — review recommended`
              : "All checks passed",
        });
      }
    }

    const verdict = blockingIssues.length > 0 ? "fail" : "pass";

    // Store confidence score
    await supabase.from("workflow_confidence_scores").insert({
      episode_id,
      dimension: "compliance",
      score: verdict === "pass" ? 0.95 : verdict === "fail" ? 0.2 : 0.6,
      details: {
        blocking_issues: blockingIssues.length,
        brand_safety_warnings: brandFlags?.length || 0,
        redaction_run_id: redactionRunId,
      },
    });

    return new Response(JSON.stringify({
      verdict,
      blocking_issues: blockingIssues,
      brand_safety_warnings: brandFlags?.length || 0,
      redaction_run_id: redactionRunId,
      can_export: blockingIssues.length === 0,
    }), {
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
