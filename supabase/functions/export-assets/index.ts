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
    const { series_id, episode_id, pack_type } = body;

    if (!series_id) throw new Error("series_id required");

    // Gather render URLs for the specified scope
    let renderQuery = supabase.from("renders").select("*");

    if (episode_id) {
      // Single episode
      const { data: ep } = await supabase
        .from("episodes")
        .select("project_id")
        .eq("id", episode_id)
        .single();
      if (ep?.project_id) {
        renderQuery = renderQuery.eq("project_id", ep.project_id);
      }
    } else {
      // All episodes in series
      const { data: episodes } = await supabase
        .from("episodes")
        .select("project_id, season:seasons!episodes_season_id_fkey(series_id)")
        .not("project_id", "is", null);
      const projectIds = episodes
        ?.filter(e => (e.season as any)?.series_id === series_id)
        ?.map(e => e.project_id)
        ?.filter(Boolean) || [];
      if (projectIds.length > 0) {
        renderQuery = renderQuery.in("project_id", projectIds);
      }
    }

    const { data: renders } = await renderQuery.eq("status", "completed");

    // Build asset manifest
    const manifest = {
      series_id,
      episode_id: episode_id || null,
      pack_type: pack_type || "full",
      created_at: new Date().toISOString(),
      assets: (renders || []).map(r => ({
        project_id: r.project_id,
        master_url_16_9: r.master_url_16_9,
        master_url_9_16: r.master_url_9_16,
        teaser_url: r.teaser_url,
        manifest_url: r.manifest_url,
        render_mode: r.render_mode,
      })),
    };

    // Create asset pack record
    const { data: pack, error: packErr } = await supabase
      .from("asset_packs")
      .insert({
        series_id,
        episode_id: episode_id || null,
        pack_type: pack_type || "full",
        manifest,
        status: "completed",
      })
      .select()
      .single();
    if (packErr) throw packErr;

    return new Response(JSON.stringify({ pack, manifest }), {
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
