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

    const { project_id } = await req.json();
    if (!project_id) throw new Error("project_id required");

    const { data: shots } = await supabase
      .from("shots")
      .select("*")
      .eq("project_id", project_id)
      .order("idx");

    if (!shots) throw new Error("No shots found");

    const summary = {
      total: shots.length,
      pending: shots.filter(s => s.status === "pending").length,
      generating: shots.filter(s => s.status === "generating").length,
      completed: shots.filter(s => s.status === "completed").length,
      failed: shots.filter(s => s.status === "failed").length,
    };

    const allDone = summary.pending === 0 && summary.generating === 0;

    return new Response(JSON.stringify({ summary, all_done: allDone, shots }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
