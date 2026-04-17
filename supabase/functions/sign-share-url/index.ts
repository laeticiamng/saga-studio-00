// PUBLIC signed-URL endpoint for shared rendered videos.
// No auth required — but the project MUST be visible in `projects_public`
// (which only exposes intentionally-shared completed projects).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TTL_SECONDS = 60 * 60 * 24; // 24h

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = await req.json().catch(() => ({}));
    const path = typeof body.path === "string" ? body.path.trim() : "";
    const projectId = typeof body.project_id === "string" ? body.project_id.trim() : "";

    if (!path || !projectId) {
      return new Response(JSON.stringify({ error: "missing_path_or_project_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Path must start with the project_id folder (defense in depth)
    if (!path.startsWith(`${projectId}/`)) {
      return new Response(JSON.stringify({ error: "path_project_mismatch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Public sharing requires the project to be in projects_public
    const { data: project, error: projErr } = await admin
      .from("projects_public")
      .select("id, status")
      .eq("id", projectId)
      .maybeSingle();

    if (projErr || !project || project.status !== "completed") {
      return new Response(JSON.stringify({ error: "not_publicly_shared" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: signed, error: signErr } = await admin.storage
      .from("renders")
      .createSignedUrl(path, TTL_SECONDS);

    if (signErr || !signed?.signedUrl) {
      return new Response(JSON.stringify({ error: "sign_failed", details: signErr?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        url: signed.signedUrl,
        expires_in: TTL_SECONDS,
        expires_at: new Date(Date.now() + TTL_SECONDS * 1000).toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: "internal", message: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
