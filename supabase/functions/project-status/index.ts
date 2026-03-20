import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let project_id: string | null = null;
    const url = new URL(req.url);
    project_id = url.searchParams.get("project_id");
    if (!project_id) {
      try {
        const body = await req.json();
        project_id = body.project_id || null;
      } catch {}
    }
    if (!project_id) throw new Error("project_id required");

    const { data: project } = await supabase.from("projects").select("*").eq("id", project_id).single();
    if (!project) throw new Error("Project not found");

    const { data: shots } = await supabase.from("shots").select("id, idx, status, output_url, provider, provider_type, error_message").eq("project_id", project_id).order("idx");
    const { data: render } = await supabase.from("renders").select("*").eq("project_id", project_id).maybeSingle();
    const { data: plan } = await supabase.from("plans").select("*").eq("project_id", project_id).order("version", { ascending: false }).limit(1).maybeSingle();
    const { data: jobs } = await supabase.from("job_queue").select("*").eq("project_id", project_id).order("created_at", { ascending: false });

    const shotSummary = {
      total: shots?.length || 0,
      completed: shots?.filter(s => s.status === "completed").length || 0,
      failed: shots?.filter(s => s.status === "failed").length || 0,
      generating: shots?.filter(s => s.status === "generating").length || 0,
      pending: shots?.filter(s => s.status === "pending").length || 0,
      image_providers: shots?.filter(s => s.provider_type === "image" || s.provider === "sora" || s.provider === "openai_image").length || 0,
      video_providers: shots?.filter(s => s.provider_type === "video" && s.provider !== "sora" && s.provider !== "openai_image").length || 0,
    };

    // Compute diagnostics
    const renderMode = render?.render_mode || "none";
    const hasManifest = !!render?.manifest_url;
    const hasServerRender = renderMode === "server" && !!render?.master_url_16_9;
    const hasClientAssembly = renderMode === "client_assembly" && hasManifest;
    const lastError = shots?.find(s => s.error_message)?.error_message || null;
    const failedShots = shots?.filter(s => s.status === "failed").map(s => ({ idx: s.idx, error: s.error_message })) || [];

    const diagnostics = {
      current_step: project.status,
      provider_used: project.provider_default || "auto",
      render_mode: renderMode,
      has_server_render: hasServerRender,
      has_client_assembly: hasClientAssembly,
      has_manifest: hasManifest,
      manifest_url: render?.manifest_url || null,
      final_artifact_available: hasServerRender,
      client_render_required: hasClientAssembly && !hasServerRender,
      last_error: lastError,
      failed_shots: failedShots,
      job_history: jobs?.map(j => ({
        step: j.step,
        status: j.status,
        retry_count: j.retry_count,
        error: j.error_message,
        started_at: j.started_at,
        completed_at: j.completed_at,
      })) || [],
    };

    return new Response(JSON.stringify({
      project,
      shot_summary: shotSummary,
      shots,
      render,
      has_plan: !!plan,
      diagnostics,
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
