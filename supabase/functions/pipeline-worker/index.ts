import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PIPELINE_STEPS = [
  { from: "analyzing", fn: "analyze-audio", next: "planning" },
  { from: "planning", fn: "plan-project", next: "generating" },
  { from: "generating", fn: "generate-shots", next: null }, // generate-shots handles its own transition
  { from: "stitching", fn: "stitch-render", next: "completed" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const baseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callFunction = async (name: string, body: any) => {
      const res = await fetch(`${baseUrl}/functions/v1/${name}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      try { return JSON.parse(text); } catch { return { raw: text }; }
    };

    const body = await req.json().catch(() => ({}));
    const singleProjectId = body.project_id;

    const results: any[] = [];

    // If a specific project was requested, process only that one
    if (singleProjectId) {
      const { data: project } = await supabase
        .from("projects")
        .select("id, status")
        .eq("id", singleProjectId)
        .single();

      if (project) {
        const result = await processProject(supabase, callFunction, project);
        results.push(result);
      }
    } else {
      // Process all active projects via job_queue
      for (const step of PIPELINE_STEPS) {
        const { data: projects } = await supabase
          .from("projects")
          .select("id, status")
          .eq("status", step.from)
          .limit(5);

        for (const project of projects || []) {
          const result = await processProject(supabase, callFunction, project);
          results.push(result);
        }
      }

      // Also check for generating projects that need shot polling
      const { data: genProjects } = await supabase
        .from("projects")
        .select("id, status")
        .eq("status", "generating")
        .limit(5);

      for (const project of genProjects || []) {
        // Check if all shots done
        const { data: shots } = await supabase
          .from("shots")
          .select("status")
          .eq("project_id", project.id);

        const allDone = shots?.every(s => s.status === "completed" || s.status === "failed");
        const hasCompleted = shots?.some(s => s.status === "completed");

        if (allDone && hasCompleted) {
          await supabase.from("projects").update({ status: "stitching" }).eq("id", project.id);
          results.push({ project_id: project.id, action: "moved_to_stitching" });
        } else if (allDone && !hasCompleted) {
          await supabase.from("projects").update({ status: "failed" }).eq("id", project.id);
          results.push({ project_id: project.id, action: "all_shots_failed" });
        }
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processProject(
  supabase: any,
  callFunction: (name: string, body: any) => Promise<any>,
  project: { id: string; status: string }
) {
  const step = PIPELINE_STEPS.find(s => s.from === project.status);
  if (!step) return { project_id: project.id, action: "no_step_for_status", status: project.status };

  // Check/create job in queue
  const { data: existingJob } = await supabase
    .from("job_queue")
    .select("*")
    .eq("project_id", project.id)
    .eq("step", step.fn)
    .in("status", ["pending", "processing"])
    .maybeSingle();

  let jobId: string;

  if (!existingJob) {
    // Create new job
    const { data: newJob, error: jobErr } = await supabase
      .from("job_queue")
      .insert({
        project_id: project.id,
        step: step.fn,
        status: "processing",
        started_at: new Date().toISOString(),
        payload: { project_id: project.id },
      })
      .select("id")
      .single();

    if (jobErr) return { project_id: project.id, error: jobErr.message };
    jobId = newJob.id;
  } else {
    jobId = existingJob.id;

    // Check if already processing and not stale (< 5 min)
    if (existingJob.status === "processing" && existingJob.started_at) {
      const started = new Date(existingJob.started_at).getTime();
      const now = Date.now();
      if (now - started < 5 * 60 * 1000) {
        return { project_id: project.id, action: "already_processing", job_id: jobId };
      }
      // Stale job — reset it
    }

    await supabase
      .from("job_queue")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", jobId);
  }

  try {
    const fnBody: any = { project_id: project.id };
    if (step.fn === "generate-shots") fnBody.batch_size = 10;

    const result = await callFunction(step.fn, fnBody);

    // Mark job completed
    await supabase
      .from("job_queue")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        result,
      })
      .eq("id", jobId);

    return { project_id: project.id, action: `executed_${step.fn}`, result };
  } catch (err: any) {
    // Check retry count
    const { data: job } = await supabase
      .from("job_queue")
      .select("retry_count, max_retries")
      .eq("id", jobId)
      .single();

    const retryCount = (job?.retry_count || 0) + 1;
    const maxRetries = job?.max_retries || 3;

    if (retryCount >= maxRetries) {
      await supabase
        .from("job_queue")
        .update({ status: "failed", error_message: err.message, retry_count: retryCount })
        .eq("id", jobId);
      await supabase.from("projects").update({ status: "failed" }).eq("id", project.id);
      return { project_id: project.id, action: "failed_max_retries", error: err.message };
    } else {
      await supabase
        .from("job_queue")
        .update({ status: "pending", error_message: err.message, retry_count: retryCount })
        .eq("id", jobId);
      return { project_id: project.id, action: "retry_scheduled", retry: retryCount, error: err.message };
    }
  }
}
