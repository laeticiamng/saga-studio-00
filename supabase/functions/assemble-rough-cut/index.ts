import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Candidate Scoring ──────────────────────────────────────────────────────

const PROVIDER_TIER_SCORES: Record<string, number> = {
  google_veo_31: 95,
  runway: 90,
  runway_act_two: 88,
  runway_aleph: 85,
  google_veo_31_lite: 82,
  luma: 80,
  luma_photon: 75,
  google_nano_banana_pro: 70,
  google_nano_banana_2: 65,
  openai_image: 60,
  sora2: 50,
  mock: 10,
};

interface ScoredCandidate {
  id: string;
  scene_id: string | null;
  idx: number;
  duration_ms: number;
  provider: string | null;
  output_url: string | null;
  asset_id: string | null;
  name: string;
  score: number;
  scoring_breakdown: {
    validation_score: number;
    provider_tier: number;
    freshness: number;
    total: number;
  };
}

function scoreCandidate(
  shot: Record<string, unknown>,
  validationScores: Map<string, number>,
  now: number
): ScoredCandidate {
  const id = shot.id as string;

  // 1. Validation score (0-100, weight 50%)
  const validationScore = validationScores.get(id) ?? 70; // default if never validated

  // 2. Provider tier (0-100, weight 30%)
  const provider = (shot.provider as string) || "mock";
  const providerTier = PROVIDER_TIER_SCORES[provider] ?? 50;

  // 3. Freshness (0-100, weight 20%) — newer is better, decays over 7 days
  const createdAt = new Date(shot.created_at as string || Date.now()).getTime();
  const ageMs = now - createdAt;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const freshness = Math.max(0, Math.round(100 - (ageDays / 7) * 50));

  const total = Math.round(validationScore * 0.5 + providerTier * 0.3 + freshness * 0.2);

  const duration_sec = (shot.duration_sec as number) || 5;

  return {
    id,
    scene_id: (shot.scene_id as string) || null,
    idx: (shot.idx as number) || 0,
    duration_ms: duration_sec * 1000,
    provider,
    output_url: (shot.output_url as string) || null,
    asset_id: null,
    name: `Shot #${shot.idx}`,
    score: total,
    scoring_breakdown: {
      validation_score: validationScore,
      provider_tier: providerTier,
      freshness,
      total,
    },
  };
}

function selectBestCandidatePerScene(candidates: ScoredCandidate[]): ScoredCandidate[] {
  // Group by scene_id, pick highest score per scene
  const byScene = new Map<string, ScoredCandidate[]>();
  const noScene: ScoredCandidate[] = [];

  for (const c of candidates) {
    if (c.scene_id) {
      const arr = byScene.get(c.scene_id) || [];
      arr.push(c);
      byScene.set(c.scene_id, arr);
    } else {
      noScene.push(c);
    }
  }

  const selected: ScoredCandidate[] = [];
  for (const [, sceneCandidates] of byScene) {
    sceneCandidates.sort((a, b) => b.score - a.score);
    selected.push(sceneCandidates[0]); // best candidate
  }

  // For shots without scenes, keep all (sorted by idx)
  noScene.sort((a, b) => a.idx - b.idx);
  selected.push(...noScene);

  return selected;
}

// ─── Incident Helper ────────────────────────────────────────────────────────

async function createIncident(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  title: string,
  detail: string,
  severity: string = "warning",
  scope: string = "project",
  scopeId?: string
) {
  await supabase.from("incidents").insert({
    project_id: projectId,
    title,
    detail,
    severity,
    scope,
    scope_id: scopeId || projectId,
    status: "open",
  }).then(({ error }) => {
    if (error) console.error("Failed to create incident:", error);
  });
}

// ─── Main Handler ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(
      authHeader?.replace("Bearer ", "") || ""
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { project_id, timeline_id } = await req.json();
    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify project ownership
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("id, user_id, type, duration_sec")
      .eq("id", project_id)
      .single();
    if (projErr || !project || project.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get or create timeline
    let tlId = timeline_id;
    if (!tlId) {
      const { data: existing } = await supabase
        .from("timelines")
        .select("id, status")
        .eq("project_id", project_id)
        .order("version", { ascending: false })
        .limit(1);

      if (existing?.length) {
        // Prevent assembly on locked timelines
        if (existing[0].status === "locked") {
          return new Response(JSON.stringify({ error: "Timeline is locked after fine_cut approval. Cannot reassemble." }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        tlId = existing[0].id;
      } else {
        const { data: newTl, error: tlErr } = await supabase
          .from("timelines")
          .insert({ project_id, name: "Rough Cut", version: 1, status: "draft" })
          .select()
          .single();
        if (tlErr) throw tlErr;
        tlId = newTl.id;
      }
    }

    // Create default tracks if none exist
    const { data: existingTracks } = await supabase
      .from("timeline_tracks")
      .select("id, track_type")
      .eq("timeline_id", tlId);

    let tracks = existingTracks || [];
    if (tracks.length === 0) {
      const trackDefs = [
        { timeline_id: tlId, track_type: "video", label: "Vidéo principale", idx: 0 },
        { timeline_id: tlId, track_type: "music", label: "Musique", idx: 1 },
        { timeline_id: tlId, track_type: "dialogue", label: "Dialogue", idx: 2 },
        { timeline_id: tlId, track_type: "fx", label: "Effets", idx: 3 },
      ];
      const { data: newTracks, error: trkErr } = await supabase
        .from("timeline_tracks")
        .insert(trackDefs)
        .select();
      if (trkErr) throw trkErr;
      tracks = newTracks || [];
    }

    const videoTrack = tracks.find((t) => t.track_type === "video");
    if (!videoTrack) {
      return new Response(JSON.stringify({ error: "No video track found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Gather all candidate shots ──────────────────────────────────────────

    // Project assets
    const { data: assets } = await supabase
      .from("project_assets")
      .select("*")
      .eq("project_id", project_id)
      .eq("status", "approved")
      .in("asset_type", ["video_clip", "shot", "hero_shot", "performance_clip"])
      .order("created_at", { ascending: true });

    // Episode shots for series projects
    let episodeShots: Array<Record<string, unknown>> = [];
    const { data: series } = await supabase
      .from("series")
      .select("id")
      .eq("project_id", project_id)
      .limit(1);

    if (series?.length) {
      const { data: seasons } = await supabase
        .from("seasons")
        .select("id")
        .eq("series_id", series[0].id);

      if (seasons?.length) {
        const { data: episodes } = await supabase
          .from("episodes")
          .select("id")
          .in("season_id", seasons.map((s) => s.id));

        if (episodes?.length) {
          const { data: shots } = await supabase
            .from("episode_shots")
            .select("*")
            .in("episode_id", episodes.map((e) => e.id))
            .eq("status", "completed")
            .order("idx", { ascending: true });

          episodeShots = (shots || []) as Array<Record<string, unknown>>;
        }
      }
    }

    // ── Fetch validation scores for ranking ─────────────────────────────────

    const shotIds = episodeShots.map((s) => s.id as string);
    const assetIds = (assets || []).map((a) => a.id);
    const validationScores = new Map<string, number>();

    if (shotIds.length > 0) {
      const { data: validations } = await supabase
        .from("asset_validations")
        .select("episode_shot_id, scores")
        .in("episode_shot_id", shotIds)
        .eq("validation_status", "passed");

      for (const v of validations || []) {
        const scores = v.scores as Record<string, number> | null;
        if (scores?.final && v.episode_shot_id) {
          validationScores.set(v.episode_shot_id, scores.final);
        }
      }
    }

    if (assetIds.length > 0) {
      const { data: assetValidations } = await supabase
        .from("asset_validations")
        .select("asset_id, scores")
        .in("asset_id", assetIds)
        .eq("validation_status", "passed");

      for (const v of assetValidations || []) {
        const scores = v.scores as Record<string, number> | null;
        if (scores?.final && v.asset_id) {
          validationScores.set(v.asset_id, scores.final);
        }
      }
    }

    // ── Get scene ordering ──────────────────────────────────────────────────

    const allSceneIds = new Set<string>();
    episodeShots.forEach((s) => { if (s.scene_id) allSceneIds.add(s.scene_id as string); });

    let sceneOrder: Record<string, number> = {};
    if (allSceneIds.size > 0) {
      const { data: scenes } = await supabase
        .from("scenes")
        .select("id, idx")
        .in("id", Array.from(allSceneIds));
      if (scenes) {
        scenes.forEach((s) => { sceneOrder[s.id] = s.idx; });
      }
    }

    // ── Score and rank candidates ───────────────────────────────────────────

    const now = Date.now();
    const scoredEpisodeShots = episodeShots.map((s) => scoreCandidate(s, validationScores, now));
    const bestPerScene = selectBestCandidatePerScene(scoredEpisodeShots);

    // Sort by scene order then idx
    bestPerScene.sort((a, b) => {
      if (a.scene_id && b.scene_id) {
        const sceneA = sceneOrder[a.scene_id] ?? 999;
        const sceneB = sceneOrder[b.scene_id] ?? 999;
        if (sceneA !== sceneB) return sceneA - sceneB;
      }
      return a.idx - b.idx;
    });

    // ── Clear non-locked clips and place ranked clips ───────────────────────

    await supabase
      .from("timeline_clips")
      .delete()
      .eq("track_id", videoTrack.id)
      .eq("locked", false);

    // Get locked clips to avoid overlapping
    const { data: lockedClips } = await supabase
      .from("timeline_clips")
      .select("start_time_ms, end_time_ms")
      .eq("track_id", videoTrack.id)
      .eq("locked", true)
      .order("start_time_ms", { ascending: true });

    const occupied = (lockedClips || []).map((c) => ({
      start: c.start_time_ms,
      end: c.end_time_ms,
    }));

    let cursor = 0;
    const clipInserts: Array<Record<string, unknown>> = [];
    const DEFAULT_CLIP_DURATION_MS = 5000;

    // Project assets (non-series) — no ranking needed, placed in order
    const projectAssetClips = (assets || []).map((a) => ({
      name: (a.metadata as Record<string, unknown>)?.name || "Clip",
      duration_ms: ((a.metadata as Record<string, unknown>)?.duration_ms as number) || DEFAULT_CLIP_DURATION_MS,
      asset_id: a.id,
      scene_id: null,
      provider: a.source_provider,
      model: a.source_model,
      score: validationScores.get(a.id) ?? 70,
      source_url: a.file_url || a.output_url || null,
      shot_id: null as string | null,
      episode_shot_id: null as string | null,
    }));

    // Combine: project assets first, then ranked episode shots
    const allClips = [
      ...projectAssetClips,
      ...bestPerScene.map((s) => ({
        name: s.name,
        duration_ms: s.duration_ms,
        asset_id: s.asset_id,
        scene_id: s.scene_id,
        provider: s.provider,
        model: null,
        score: s.score,
        source_url: s.output_url,
        shot_id: null as string | null,
        episode_shot_id: s.id,
      })),
    ];

    for (const clip of allClips) {
      // Skip past occupied ranges
      for (const range of occupied) {
        if (cursor >= range.start && cursor < range.end) {
          cursor = range.end;
        }
      }

      const startMs = cursor;
      const endMs = cursor + clip.duration_ms;

      clipInserts.push({
        track_id: videoTrack.id,
        name: clip.name,
        start_time_ms: startMs,
        end_time_ms: endMs,
        asset_id: clip.asset_id,
        scene_id: clip.scene_id,
        provider: clip.provider,
        model: clip.model,
        source_url: clip.source_url,
        episode_shot_id: clip.episode_shot_id,
        status: "placed",
        locked: false,
      });

      cursor = endMs;
    }

    if (clipInserts.length > 0) {
      const { error: insertErr } = await supabase
        .from("timeline_clips")
        .insert(clipInserts);
      if (insertErr) throw insertErr;
    }

    // Update timeline status
    await supabase
      .from("timelines")
      .update({ status: "assembled", duration_sec: Math.ceil(cursor / 1000) })
      .eq("id", tlId);

    // Create review gate for rough_cut approval if needed
    const { data: existingGate } = await supabase
      .from("review_gates")
      .select("id")
      .eq("project_id", project_id)
      .eq("gate_type", "rough_cut")
      .limit(1);

    if (!existingGate?.length) {
      await supabase.from("review_gates").insert({
        project_id,
        gate_type: "rough_cut",
        status: "pending",
      });
    }

    // Log ranking details as diagnostic
    await supabase.from("diagnostic_events").insert({
      project_id,
      event_type: "auto_assembly",
      severity: "info",
      title: `Auto-assembly: ${clipInserts.length} clips placed (${scoredEpisodeShots.length} candidates evaluated)`,
      detail: bestPerScene.map((c) =>
        `${c.name} [scene:${c.scene_id?.slice(0, 8) || "none"}] score:${c.score} (val:${c.scoring_breakdown.validation_score} prov:${c.scoring_breakdown.provider_tier} fresh:${c.scoring_breakdown.freshness})`
      ).join("\n"),
      scope: "timeline",
      scope_id: tlId,
    });

    // Create incident if no clips were placed
    if (clipInserts.length === 0) {
      await createIncident(supabase, project_id, "Auto-assembly produced empty timeline",
        "No approved or completed clips were available for assembly. Check shot generation status.",
        "critical", "timeline", tlId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        timeline_id: tlId,
        clips_placed: clipInserts.length,
        candidates_evaluated: scoredEpisodeShots.length,
        total_duration_ms: cursor,
        ranking_summary: bestPerScene.map((c) => ({
          shot: c.name,
          scene_id: c.scene_id,
          score: c.score,
          provider: c.provider,
          breakdown: c.scoring_breakdown,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("assemble-rough-cut error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
