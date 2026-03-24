import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * delivery-qc: Final quality control gate before export/delivery.
 * Checks: continuity, compliance, render quality, completeness, and brand safety.
 * Blocks delivery if any critical check fails.
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

    const checks: Array<{ name: string; status: string; details: string }> = [];
    const blockingIssues: Array<{ check: string; reason: string }> = [];
    const warnings: Array<{ check: string; reason: string }> = [];

    // 1. Continuity check
    const { data: continuityReports } = await supabase
      .from("continuity_reports")
      .select("verdict, issues, summary")
      .eq("episode_id", episode_id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!continuityReports || continuityReports.length === 0) {
      blockingIssues.push({ check: "continuity", reason: "No continuity report found" });
      checks.push({ name: "continuity", status: "fail", details: "No report" });
    } else if (continuityReports[0].verdict === "block") {
      blockingIssues.push({ check: "continuity", reason: `Continuity blocked: ${continuityReports[0].summary}` });
      checks.push({ name: "continuity", status: "fail", details: continuityReports[0].summary || "" });
    } else {
      checks.push({ name: "continuity", status: "pass", details: continuityReports[0].summary || "OK" });
    }

    // 2. Psychology review
    const { data: psychReviews } = await supabase
      .from("psychology_reviews")
      .select("verdict, recommendations")
      .eq("episode_id", episode_id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!psychReviews || psychReviews.length === 0) {
      warnings.push({ check: "psychology", reason: "No psychology review found" });
      checks.push({ name: "psychology", status: "warn", details: "No review" });
    } else if (psychReviews[0].verdict === "block") {
      blockingIssues.push({ check: "psychology", reason: psychReviews[0].recommendations || "Blocked" });
      checks.push({ name: "psychology", status: "fail", details: psychReviews[0].recommendations || "" });
    } else {
      checks.push({ name: "psychology", status: "pass", details: "OK" });
    }

    // 3. Legal/ethics review
    const { data: legalReviews } = await supabase
      .from("legal_ethics_reviews")
      .select("verdict, recommendations")
      .eq("episode_id", episode_id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!legalReviews || legalReviews.length === 0) {
      warnings.push({ check: "legal_ethics", reason: "No legal/ethics review found" });
      checks.push({ name: "legal_ethics", status: "warn", details: "No review" });
    } else if (legalReviews[0].verdict === "block") {
      blockingIssues.push({ check: "legal_ethics", reason: legalReviews[0].recommendations || "Blocked" });
      checks.push({ name: "legal_ethics", status: "fail", details: legalReviews[0].recommendations || "" });
    } else {
      checks.push({ name: "legal_ethics", status: "pass", details: "OK" });
    }

    // 4. Brand safety
    const { data: brandFlags } = await supabase
      .from("brand_safety_flags")
      .select("*")
      .eq("episode_id", episode_id)
      .eq("resolved", false);

    const criticalBrandFlags = brandFlags?.filter(f => f.severity === "critical") || [];
    if (criticalBrandFlags.length > 0) {
      blockingIssues.push({ check: "brand_safety", reason: `${criticalBrandFlags.length} critical brand safety flag(s)` });
      checks.push({ name: "brand_safety", status: "fail", details: `${criticalBrandFlags.length} critical flags` });
    } else if (brandFlags && brandFlags.length > 0) {
      warnings.push({ check: "brand_safety", reason: `${brandFlags.length} unresolved warning(s)` });
      checks.push({ name: "brand_safety", status: "warn", details: `${brandFlags.length} warnings` });
    } else {
      checks.push({ name: "brand_safety", status: "pass", details: "OK" });
    }

    // 5. Completeness: check scenes exist
    const { count: sceneCount } = await supabase
      .from("scenes")
      .select("id", { count: "exact", head: true })
      .eq("episode_id", episode_id);

    if (!sceneCount || sceneCount === 0) {
      blockingIssues.push({ check: "completeness_scenes", reason: "No scenes found" });
      checks.push({ name: "scenes", status: "fail", details: "No scenes" });
    } else {
      checks.push({ name: "scenes", status: "pass", details: `${sceneCount} scenes` });
    }

    // 6. Script exists
    const { data: script } = await supabase
      .from("scripts")
      .select("id, current_version")
      .eq("episode_id", episode_id)
      .single();

    if (!script) {
      blockingIssues.push({ check: "completeness_script", reason: "No script found" });
      checks.push({ name: "script", status: "fail", details: "No script" });
    } else {
      checks.push({ name: "script", status: "pass", details: `v${script.current_version}` });
    }

    // 7. Confidence scores
    const { data: confidenceScores } = await supabase
      .from("workflow_confidence_scores")
      .select("dimension, score")
      .eq("episode_id", episode_id);

    const avgConfidence = confidenceScores && confidenceScores.length > 0
      ? confidenceScores.reduce((sum, s) => sum + Number(s.score), 0) / confidenceScores.length
      : 0;

    if (avgConfidence < 0.5 && confidenceScores && confidenceScores.length > 0) {
      warnings.push({ check: "confidence", reason: `Low average confidence: ${(avgConfidence * 100).toFixed(1)}%` });
    }
    checks.push({ name: "confidence", status: avgConfidence >= 0.7 ? "pass" : avgConfidence >= 0.5 ? "warn" : "fail", details: `${(avgConfidence * 100).toFixed(1)}%` });

    // Overall verdict
    const overallVerdict = blockingIssues.length > 0 ? "fail" : warnings.length > 0 ? "conditional_pass" : "pass";
    const overallScore = Math.max(0, 1 - (blockingIssues.length * 0.3) - (warnings.length * 0.1));

    // Create or update delivery manifest
    const resolvedSeriesId = series_id || (await supabase
      .from("episodes")
      .select("season:seasons!episodes_season_id_fkey(series_id)")
      .eq("id", episode_id)
      .single())?.data?.season?.series_id;

    if (resolvedSeriesId) {
      const manifestStatus = overallVerdict === "pass" ? "qc_passed" : overallVerdict === "conditional_pass" ? "qc_passed" : "qc_failed";

      const { data: manifest } = await supabase
        .from("delivery_manifests")
        .upsert({
          series_id: resolvedSeriesId,
          episode_id,
          manifest_type: "episode",
          status: manifestStatus,
          metadata: { qc_verdict: overallVerdict, checks, blockingIssues, warnings },
        }, { onConflict: "series_id,episode_id" })
        .select()
        .single()
        .then(r => r)
        .catch(() => ({ data: null }));

      // Create QC report
      await supabase.from("qc_reports").insert({
        delivery_manifest_id: manifest?.id || null,
        episode_id,
        checks,
        overall_verdict: overallVerdict,
        blocking_issues: blockingIssues,
        warnings,
        score: overallScore,
        checked_by: "delivery_qc_system",
      });
    }

    return new Response(JSON.stringify({
      verdict: overallVerdict,
      score: overallScore,
      checks,
      blocking_issues: blockingIssues,
      warnings,
      can_deliver: blockingIssues.length === 0,
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
