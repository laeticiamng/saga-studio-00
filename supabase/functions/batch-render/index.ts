import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const { series_id, season_id, episode_ids } = body;

    if (!series_id) throw new Error("series_id required");
    if (!episode_ids || !Array.isArray(episode_ids) || episode_ids.length === 0) {
      throw new Error("episode_ids array required");
    }

    // Create render batch
    const { data: batch, error: batchErr } = await supabase
      .from("render_batches")
      .insert({
        series_id,
        season_id: season_id || null,
        episode_ids,
        status: "processing",
        progress: { completed: 0, total: episode_ids.length, current: null },
      })
      .select()
      .single();
    if (batchErr) throw batchErr;

    // Trigger stitch-render for each episode (fire-and-forget)
    for (const epId of episode_ids) {
      // Get the episode's project_id
      const { data: episode } = await supabase
        .from("episodes")
        .select("project_id")
        .eq("id", epId)
        .single();

      if (episode?.project_id) {
        supabase.functions.invoke("stitch-render", {
          body: { project_id: episode.project_id },
        }).catch(() => { /* fire and forget */ });
      }
    }

    return new Response(JSON.stringify({ batch }), {
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
