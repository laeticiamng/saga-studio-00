import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Cleanup orphaned data:
 * - Shots without a valid project (already handled by CASCADE, but cleans pre-migration orphans)
 * - Renders stuck in "pending" for > 24h (GC placeholders)
 * - Jobs stuck in "processing" for > 30min
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results: Record<string, number> = {};

    // 1. Clean orphan shots (project_id not in projects — pre-migration leftovers)
    const { data: orphanShots } = await supabase
      .from("shots")
      .select("id, project_id")
      .limit(500);

    if (orphanShots && orphanShots.length > 0) {
      const projectIds = [...new Set(orphanShots.map(s => s.project_id))];
      const { data: validProjects } = await supabase
        .from("projects")
        .select("id")
        .in("id", projectIds);

      const validIds = new Set(validProjects?.map(p => p.id) || []);
      const orphanIds = orphanShots.filter(s => !validIds.has(s.project_id)).map(s => s.id);

      if (orphanIds.length > 0) {
        await supabase.from("shots").delete().in("id", orphanIds);
        results.orphan_shots_deleted = orphanIds.length;
      }
    }

    // 2. GC renders stuck in "pending" for > 24h with no real URLs
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: staleRenders, count: staleCount } = await supabase
      .from("renders")
      .select("id, project_id", { count: "exact" })
      .eq("status", "pending")
      .lt("created_at", oneDayAgo)
      .is("master_url_16_9", null);

    if (staleRenders && staleRenders.length > 0) {
      const staleIds = staleRenders.map(r => r.id);
      await supabase.from("renders").update({ status: "failed", logs: JSON.stringify({ gc_reason: "stale_pending_24h" }) }).in("id", staleIds);
      // Also fail their projects if still stitching
      const projectIds = staleRenders.map(r => r.project_id);
      await supabase.from("projects").update({ status: "failed" }).in("id", projectIds).eq("status", "stitching");
      results.stale_renders_failed = staleRenders.length;
    }

    // 3. Unstick jobs in "processing" for > 30min
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: stuckJobs } = await supabase
      .from("job_queue")
      .select("id, retry_count, max_retries")
      .eq("status", "processing")
      .lt("started_at", thirtyMinAgo)
      .limit(50);

    if (stuckJobs && stuckJobs.length > 0) {
      for (const job of stuckJobs) {
        const retries = (job.retry_count || 0) + 1;
        const maxRetries = job.max_retries || 3;
        const newStatus = retries >= maxRetries ? "failed" : "pending";
        await supabase.from("job_queue").update({
          status: newStatus,
          retry_count: retries,
          error_message: "Timed out after 30min, reset by cleanup job",
        }).eq("id", job.id);
      }
      results.stuck_jobs_reset = stuckJobs.length;
    }

    return new Response(JSON.stringify({ success: true, cleanup: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
