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

    // ── Query extracted entities from corpus to pre-fill episodes ──
    const { data: extractedEpisodes } = await supabase
      .from("source_document_entities")
      .select("entity_key, entity_value, extraction_confidence, document_id")
      .eq("entity_type", "episode")
      .in("status", ["confirmed", "proposed"])
      .gte("extraction_confidence", 0.4)
      .order("extraction_confidence", { ascending: false })
      .limit(200);

    // Filter to entities belonging to this project's documents
    let projectEpisodeEntities: Array<{ entity_key: string; entity_value: Record<string, unknown>; extraction_confidence: number }> = [];
    if (extractedEpisodes?.length) {
      const { data: projectDocs } = await supabase
        .from("source_documents")
        .select("id")
        .eq("project_id", project.id);
      const projectDocIds = new Set((projectDocs || []).map((d: any) => d.id));
      projectEpisodeEntities = (extractedEpisodes as any[])
        .filter((e: any) => projectDocIds.has(e.document_id))
        .map((e: any) => ({
          entity_key: e.entity_key,
          entity_value: typeof e.entity_value === "string" ? JSON.parse(e.entity_value) : e.entity_value,
          extraction_confidence: e.extraction_confidence,
        }));
    }

    // Build a map of episode number → extracted data (deduped by confidence)
    const episodeDataMap = new Map<number, { title?: string; synopsis?: string; duration_target_min?: number }>();
    for (const ent of projectEpisodeEntities) {
      const val = ent.entity_value as Record<string, unknown>;
      const epNum = Number(val.number || val.episode_number || ent.entity_key?.match(/\d+/)?.[0]);
      if (!epNum || epNum < 1 || epNum > 50) continue;
      if (!episodeDataMap.has(epNum)) {
        episodeDataMap.set(epNum, {
          title: (val.title as string) || undefined,
          synopsis: (val.synopsis as string) || undefined,
          duration_target_min: val.duration ? Number(val.duration) : undefined,
        });
      }
    }

    // Create initial episodes with extracted data
    const episodeInserts = [];
    for (let i = 1; i <= Math.min(epPerSeason, 50); i++) {
      const extracted = episodeDataMap.get(i);
      episodeInserts.push({
        season_id: season.id,
        number: i,
        title: extracted?.title || `Épisode ${i}`,
        synopsis: extracted?.synopsis || null,
        status: "draft",
        duration_target_min: extracted?.duration_target_min || epDuration,
      });
    }
    if (episodeInserts.length > 0) {
      await supabase.from("episodes").insert(episodeInserts);
    }

    // ── Auto-create character profiles from extracted entities ──
    const { data: extractedCharacters } = await supabase
      .from("source_document_entities")
      .select("entity_key, entity_value, extraction_confidence, document_id")
      .eq("entity_type", "character")
      .in("status", ["confirmed", "proposed"])
      .gte("extraction_confidence", 0.5)
      .order("extraction_confidence", { ascending: false })
      .limit(100);

    if (extractedCharacters?.length) {
      const { data: projectDocs } = await supabase
        .from("source_documents")
        .select("id")
        .eq("project_id", project.id);
      const projectDocIds = new Set((projectDocs || []).map((d: any) => d.id));

      const seenNames = new Set<string>();
      const characterInserts: Array<Record<string, unknown>> = [];

      for (const ent of extractedCharacters as any[]) {
        if (!projectDocIds.has(ent.document_id)) continue;
        const val = typeof ent.entity_value === "string" ? JSON.parse(ent.entity_value) : ent.entity_value;
        const name = (val.name || ent.entity_key || "").trim();
        if (!name || seenNames.has(name.toLowerCase())) continue;
        seenNames.add(name.toLowerCase());
        characterInserts.push({
          series_id: series.id,
          name,
          visual_description: val.visual_description || val.appearance || null,
          personality: val.personality || null,
          backstory: val.backstory || null,
          arc: val.arc || val.character_arc || null,
          wardrobe: val.wardrobe || val.costume || null,
          voice_notes: val.voice_notes || val.voice || null,
          relationships: val.relationships || null,
        });
      }

      if (characterInserts.length > 0) {
        await supabase.from("character_profiles").insert(characterInserts);
      }
    }

    // ── Auto-create bible entries from extracted locations/world data ──
    const { data: worldEntities } = await supabase
      .from("source_document_entities")
      .select("entity_type, entity_key, entity_value, document_id")
      .in("entity_type", ["location", "visual_reference", "mood", "prop", "act_structure", "season_arc"])
      .in("status", ["confirmed", "proposed"])
      .gte("extraction_confidence", 0.5)
      .limit(100);

    if (worldEntities?.length) {
      const { data: projectDocs } = await supabase
        .from("source_documents")
        .select("id")
        .eq("project_id", project.id);
      const projectDocIds = new Set((projectDocs || []).map((d: any) => d.id));

      const worldContent: Record<string, unknown[]> = { locations: [], visual_references: [], props: [], act_structure: [], season_arcs: [] };
      let hasWorldData = false;

      for (const ent of worldEntities as any[]) {
        if (!projectDocIds.has(ent.document_id)) continue;
        hasWorldData = true;
        const val = typeof ent.entity_value === "string" ? JSON.parse(ent.entity_value) : ent.entity_value;
        switch (ent.entity_type) {
          case "location": worldContent.locations.push({ name: ent.entity_key, ...val }); break;
          case "visual_reference": worldContent.visual_references.push({ key: ent.entity_key, ...val }); break;
          case "prop": worldContent.props.push({ name: ent.entity_key, ...val }); break;
          case "act_structure": worldContent.act_structure.push(val); break;
          case "season_arc": worldContent.season_arcs.push(val); break;
          case "mood": worldContent.visual_references.push({ type: "mood", key: ent.entity_key, ...val }); break;
        }
      }

      if (hasWorldData) {
        await supabase.from("bibles").insert({
          series_id: series.id,
          name: "Bible Monde (auto-générée)",
          type: "world",
          content: worldContent,
          version: 1,
        });
      }
    }

    // ── Audit log ──
    await supabase.from("audit_logs").insert({
      action: "series_created",
      entity_type: "series",
      entity_id: series.id,
      user_id: user.id,
      details: {
        project_id: project.id,
        episodes_created: episodeInserts.length,
        episodes_prefilled: episodeDataMap.size,
        characters_created: extractedCharacters?.length || 0,
      },
    }).then(() => {}).catch(() => {});

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
