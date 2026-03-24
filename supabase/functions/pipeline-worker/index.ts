import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PIPELINE_STEPS = [
  { from: "analyzing", fn: "analyze-audio", next: "planning" },
  { from: "planning", fn: "plan-project", next: "generating" },
  { from: "generating", fn: "generate-shots", next: null },
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

    if (singleProjectId) {
      // Series projects use the episode-pipeline, not this worker
      const { data: proj } = await supabase
        .from("projects").select("type").eq("id", singleProjectId).single();
      if (proj?.type === "series") {
        return new Response(JSON.stringify({
          skipped: true,
          reason: "Series projects use episode-pipeline instead of pipeline-worker",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Auto-loop: keep processing steps until we hit a waiting/terminal state
      const loopResults = await loopProject(supabase, callFunction, singleProjectId);
      results.push(...loopResults);
    } else {
      // Batch mode: process all active projects (one step each)
      for (const step of PIPELINE_STEPS) {
        const { data: projects } = await supabase
          .from("projects").select("id, status, type").eq("status", step.from).neq("type", "series").limit(5);
        for (const project of projects || []) {
          const r = await executeStep(supabase, callFunction, project);
          results.push(r);
        }
      }
      // Check generating projects for completion
      await checkGeneratingProjects(supabase, results);
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
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

// Loop a single project through all pipeline steps until it reaches a waiting/terminal state
async function loopProject(
  supabase: any,
  callFunction: (name: string, body: any) => Promise<any>,
  projectId: string,
  maxIterations = 10
) {
  const results: any[] = [];

  for (let i = 0; i < maxIterations; i++) {
    const { data: project } = await supabase
      .from("projects").select("id, status").eq("id", projectId).single();
    if (!project) break;

    const { status } = project;

    // Terminal states — stop
    if (["completed", "failed", "cancelled", "draft"].includes(status)) {
      results.push({ project_id: projectId, action: "terminal_state", status });
      break;
    }

    // Generating — check shots, call check-shot-status, maybe transition
    if (status === "generating") {
      const genResult = await handleGeneratingPhase(supabase, callFunction, projectId);
      results.push(genResult);
      // If still generating (waiting on providers), stop looping
      if (genResult.action !== "moved_to_stitching") break;
      continue; // Re-loop to process stitching
    }

    // Normal step execution
    const step = PIPELINE_STEPS.find(s => s.from === status);
    if (!step) {
      results.push({ project_id: projectId, action: "no_step_for_status", status });
      break;
    }

    const result = await executeStep(supabase, callFunction, project);
    results.push(result);

    // If step failed or is retrying, stop
    if (result.action?.includes("failed") || result.action?.includes("retry")) break;

    // Small delay to avoid hammering
    await new Promise(r => setTimeout(r, 200));
  }

  return results;
}

// Handle the "generating" phase: dispatch pending shots + check status of in-flight shots
async function handleGeneratingPhase(
  supabase: any,
  callFunction: (name: string, body: any) => Promise<any>,
  projectId: string
) {
  // First, dispatch any pending shots
  const { data: pendingShots } = await supabase
    .from("shots").select("id").eq("project_id", projectId).eq("status", "pending").limit(1);

  if (pendingShots && pendingShots.length > 0) {
    await callFunction("generate-shots", { project_id: projectId, batch_size: 10 });
  }

  // Then check status of generating shots
  await callFunction("check-shot-status", { project_id: projectId });

  // Re-check shot statuses
  const { data: allShots } = await supabase
    .from("shots").select("status").eq("project_id", projectId);

  const allDone = allShots?.every((s: any) => s.status === "completed" || s.status === "failed");
  const hasCompleted = allShots?.some((s: any) => s.status === "completed");

  if (allDone && hasCompleted) {
    await supabase.from("projects").update({ status: "stitching" }).eq("id", projectId);
    return { project_id: projectId, action: "moved_to_stitching" };
  } else if (allDone && !hasCompleted) {
    await supabase.from("projects").update({ status: "failed" }).eq("id", projectId);
    return { project_id: projectId, action: "all_shots_failed" };
  }

  return { project_id: projectId, action: "generating_in_progress", 
    total: allShots?.length || 0,
    completed: allShots?.filter((s: any) => s.status === "completed").length || 0 };
}

// Execute a single pipeline step with job_queue tracking
async function executeStep(
  supabase: any,
  callFunction: (name: string, body: any) => Promise<any>,
  project: { id: string; status: string }
) {
  const step = PIPELINE_STEPS.find(s => s.from === project.status);
  if (!step) return { project_id: project.id, action: "no_step_for_status", status: project.status };

  // Check/create job in queue
  const { data: existingJob } = await supabase
    .from("job_queue").select("*")
    .eq("project_id", project.id).eq("step", step.fn)
    .in("status", ["pending", "processing"]).maybeSingle();

  let jobId: string;

  if (!existingJob) {
    const { data: newJob, error: jobErr } = await supabase
      .from("job_queue").insert({
        project_id: project.id, step: step.fn, status: "processing",
        started_at: new Date().toISOString(), payload: { project_id: project.id },
      }).select("id").single();
    if (jobErr) return { project_id: project.id, error: jobErr.message };
    jobId = newJob.id;
  } else {
    jobId = existingJob.id;
    if (existingJob.status === "processing" && existingJob.started_at) {
      const elapsed = Date.now() - new Date(existingJob.started_at).getTime();
      if (elapsed < 5 * 60 * 1000) {
        return { project_id: project.id, action: "already_processing", job_id: jobId };
      }
    }
    await supabase.from("job_queue")
      .update({ status: "processing", started_at: new Date().toISOString() }).eq("id", jobId);
  }

  try {
    const fnBody: any = { project_id: project.id };
    if (step.fn === "generate-shots") fnBody.batch_size = 10;

    const result = await callFunction(step.fn, fnBody);

    await supabase.from("job_queue").update({
      status: "completed", completed_at: new Date().toISOString(), result,
    }).eq("id", jobId);

    return { project_id: project.id, action: `executed_${step.fn}`, result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const { data: job } = await supabase
      .from("job_queue").select("retry_count, max_retries").eq("id", jobId).single();

    const retryCount = (job?.retry_count || 0) + 1;
    const maxRetries = job?.max_retries || 3;

    if (retryCount >= maxRetries) {
      await supabase.from("job_queue")
        .update({ status: "failed", error_message: message, retry_count: retryCount }).eq("id", jobId);
      await supabase.from("projects").update({ status: "failed" }).eq("id", project.id);
      return { project_id: project.id, action: "failed_max_retries", error: message };
    } else {
      await supabase.from("job_queue")
        .update({ status: "pending", error_message: message, retry_count: retryCount }).eq("id", jobId);
      return { project_id: project.id, action: "retry_scheduled", retry: retryCount, error: message };
    }
  }
}

// Check generating projects for batch mode
async function checkGeneratingProjects(supabase: any, results: any[]) {
  const { data: genProjects } = await supabase
    .from("projects").select("id, status").eq("status", "generating").limit(5);

  for (const project of genProjects || []) {
    const { data: shots } = await supabase
      .from("shots").select("status").eq("project_id", project.id);

    const allDone = shots?.every((s: any) => s.status === "completed" || s.status === "failed");
    const hasCompleted = shots?.some((s: any) => s.status === "completed");

    if (allDone && hasCompleted) {
      await supabase.from("projects").update({ status: "stitching" }).eq("id", project.id);
      results.push({ project_id: project.id, action: "moved_to_stitching" });
    } else if (allDone && !hasCompleted) {
      await supabase.from("projects").update({ status: "failed" }).eq("id", project.id);
      results.push({ project_id: project.id, action: "all_shots_failed" });
    }
  }
}
