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
      return res.json();
    };

    // Find projects that need processing
    const { data: analyzingProjects } = await supabase
      .from("projects")
      .select("id")
      .eq("status", "analyzing")
      .limit(3);

    const { data: planningProjects } = await supabase
      .from("projects")
      .select("id")
      .eq("status", "planning")
      .limit(3);

    const { data: generatingProjects } = await supabase
      .from("projects")
      .select("id")
      .eq("status", "generating")
      .limit(3);

    const { data: stitchingProjects } = await supabase
      .from("projects")
      .select("id")
      .eq("status", "stitching")
      .limit(3);

    const results: any[] = [];

    // Process analyzing -> plan
    for (const p of analyzingProjects || []) {
      try {
        // Check if analysis already exists
        const { data: existing } = await supabase
          .from("audio_analysis")
          .select("id")
          .eq("project_id", p.id)
          .maybeSingle();

        if (existing) {
          // Analysis done, move to planning
          await supabase.from("projects").update({ status: "planning" }).eq("id", p.id);
          results.push({ project_id: p.id, action: "moved_to_planning" });
        } else {
          const r = await callFunction("analyze-audio", { project_id: p.id });
          results.push({ project_id: p.id, action: "analyzed", result: r });
        }
      } catch (err) {
        results.push({ project_id: p.id, error: err.message });
      }
    }

    // Process planning -> generate
    for (const p of planningProjects || []) {
      try {
        const { data: existingPlan } = await supabase
          .from("plans")
          .select("id")
          .eq("project_id", p.id)
          .maybeSingle();

        if (existingPlan) {
          await supabase.from("projects").update({ status: "generating" }).eq("id", p.id);
          results.push({ project_id: p.id, action: "moved_to_generating" });
        } else {
          const r = await callFunction("plan-project", { project_id: p.id });
          results.push({ project_id: p.id, action: "planned", result: r });
        }
      } catch (err) {
        results.push({ project_id: p.id, error: err.message });
      }
    }

    // Process generating shots
    for (const p of generatingProjects || []) {
      try {
        const r = await callFunction("generate-shots", { project_id: p.id, batch_size: 5 });
        results.push({ project_id: p.id, action: "generating_shots", result: r });
      } catch (err) {
        results.push({ project_id: p.id, error: err.message });
      }
    }

    // Process stitching
    for (const p of stitchingProjects || []) {
      try {
        const r = await callFunction("stitch-render", { project_id: p.id });
        results.push({ project_id: p.id, action: "stitched", result: r });
      } catch (err) {
        results.push({ project_id: p.id, error: err.message });
      }
    }

    return new Response(JSON.stringify({
      processed: results.length,
      results,
      queued: {
        analyzing: analyzingProjects?.length || 0,
        planning: planningProjects?.length || 0,
        generating: generatingProjects?.length || 0,
        stitching: stitchingProjects?.length || 0,
      },
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
