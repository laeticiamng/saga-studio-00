import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) throw new Error("Unauthorized");

    if (isRateLimited(user.id)) {
      return new Response(JSON.stringify({ error: "Trop de requêtes. Réessayez dans une minute." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check feature flag
    const { data: flag } = await supabase
      .from("feature_flags")
      .select("enabled")
      .eq("key", "series_enabled")
      .single();
    if (!flag?.enabled) {
      throw new Error("La fonctionnalité Séries n'est pas encore activée.");
    }

    const body = await req.json();
    const { title, logline, genre, tone, target_audience, total_seasons, style_preset, episode_duration_min, episodes_per_season } = body;

    if (!title || typeof title !== "string" || title.length > 200) {
      throw new Error("Titre requis (max 200 caractères)");
    }

    // Debit credits for series creation
    const { data: debited } = await supabase.rpc("debit_credits", {
      p_user_id: user.id,
      p_amount: 5,
      p_reason: "Création de série",
      p_ref_type: "series_creation",
    });
    if (!debited) {
      throw new Error("Crédits insuffisants (5 requis minimum)");
    }

    // Create project with type='series'
    const { data: project, error: projectErr } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        type: "series",
        title,
        style_preset: style_preset || "cinematic",
        status: "draft",
      })
      .select()
      .single();
    if (projectErr) throw projectErr;

    // Create series record
    const epDuration = episode_duration_min || 50;
    const epPerSeason = episodes_per_season || 10;

    const { data: series, error: seriesErr } = await supabase
      .from("series")
      .insert({
        project_id: project.id,
        logline: logline || null,
        genre: genre || null,
        tone: tone || null,
        target_audience: target_audience || null,
        total_seasons: total_seasons || 1,
        episode_duration_min: epDuration,
        episodes_per_season: epPerSeason,
      })
      .select()
      .single();
    if (seriesErr) throw seriesErr;

    // Create initial season
    const { data: season, error: seasonErr } = await supabase
      .from("seasons")
      .insert({
        series_id: series.id,
        number: 1,
        title: "Saison 1",
      })
      .select()
      .single();
    if (seasonErr) throw seasonErr;

    // Create initial episodes with duration targets
    const episodeInserts = [];
    for (let i = 1; i <= Math.min(epPerSeason, 50); i++) {
      episodeInserts.push({
        season_id: season.id,
        number: i,
        title: `Épisode ${i}`,
        status: "draft",
        duration_target_min: epDuration,
      });
    }
    if (episodeInserts.length > 0) {
      await supabase.from("episodes").insert(episodeInserts);
    }

    return new Response(JSON.stringify({ project, series, season }), {
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
