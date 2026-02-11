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

    const url = new URL(req.url);
    const project_id = url.searchParams.get("project_id");
    if (!project_id) throw new Error("project_id required");

    const { data: project } = await supabase.from("projects").select("*").eq("id", project_id).single();
    if (!project) throw new Error("Project not found");

    const { data: shots } = await supabase.from("shots").select("id, idx, status, output_url, provider").eq("project_id", project_id).order("idx");
    const { data: render } = await supabase.from("renders").select("*").eq("project_id", project_id).maybeSingle();
    const { data: plan } = await supabase.from("plans").select("*").eq("project_id", project_id).order("version", { ascending: false }).limit(1).maybeSingle();

    const shotSummary = {
      total: shots?.length || 0,
      completed: shots?.filter(s => s.status === "completed").length || 0,
      failed: shots?.filter(s => s.status === "failed").length || 0,
      generating: shots?.filter(s => s.status === "generating").length || 0,
    };

    return new Response(JSON.stringify({
      project,
      shot_summary: shotSummary,
      shots,
      render,
      has_plan: !!plan,
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
