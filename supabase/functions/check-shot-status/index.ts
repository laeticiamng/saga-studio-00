import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_RETRIES_PER_SHOT = 2;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { project_id } = await req.json();
    if (!project_id) throw new Error("project_id required");

    const { data: shots } = await supabase
      .from("shots")
      .select("*")
      .eq("project_id", project_id)
      .order("idx");

    if (!shots) throw new Error("No shots found");

    const retried: string[] = [];
    const failedPermanently: string[] = [];

    // Check failed shots and retry if under limit
    for (const shot of shots) {
      if (shot.status === "failed") {
        // Count existing retries from error_message pattern
        const retryCount = (shot.error_message?.match(/\[retry (\d+)\]/)?.[1] || "0");
        const currentRetries = parseInt(retryCount, 10);

        if (currentRetries < MAX_RETRIES_PER_SHOT) {
          // Reset to pending for retry
          await supabase.from("shots").update({
            status: "pending",
            error_message: `[retry ${currentRetries + 1}] ${shot.error_message || "retrying"}`,
          }).eq("id", shot.id);
          retried.push(shot.id);
        } else {
          failedPermanently.push(shot.id);
        }
      }

      // Check for stale "generating" shots (stuck > 5 min)
      if (shot.status === "generating") {
        const updated = new Date(shot.updated_at).getTime();
        const now = Date.now();
        if (now - updated > 5 * 60 * 1000) {
          await supabase.from("shots").update({
            status: "failed",
            error_message: "Timed out after 5 minutes",
          }).eq("id", shot.id);
        }
      }
    }

    const summary = {
      total: shots.length,
      pending: shots.filter(s => s.status === "pending").length + retried.length,
      generating: shots.filter(s => s.status === "generating").length,
      completed: shots.filter(s => s.status === "completed").length,
      failed: shots.filter(s => s.status === "failed").length - retried.length,
    };

    const allDone = summary.pending === 0 && summary.generating === 0;

    // If all done, transition project
    if (allDone && summary.completed > 0) {
      await supabase.from("projects").update({ status: "stitching" }).eq("id", project_id);
    } else if (allDone && summary.completed === 0) {
      await supabase.from("projects").update({ status: "failed" }).eq("id", project_id);
    }

    return new Response(JSON.stringify({
      summary,
      all_done: allDone,
      retried: retried.length,
      failed_permanently: failedPermanently.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
