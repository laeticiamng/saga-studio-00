import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
        .select("id")
        .eq("project_id", project_id)
        .order("version", { ascending: false })
        .limit(1);

      if (existing?.length) {
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

    // Gather approved assets (shots) for this project
    // For series: get episode shots; for standalone: get project assets
    const { data: assets } = await supabase
      .from("project_assets")
      .select("*")
      .eq("project_id", project_id)
      .eq("status", "approved")
      .in("asset_type", ["video_clip", "shot", "hero_shot", "performance_clip"])
      .order("created_at", { ascending: true });

    // Also try episode_shots for series projects
    let episodeShots: Array<Record<string, unknown>> = [];
    const { data: series } = await supabase
      .from("series")
      .select("id")
      .eq("project_id", project_id)
      .limit(1);

    if (series?.length) {
      // Get all episodes for this series
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

    // Get scenes for ordering
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

    // Sort episode shots by scene order then by idx
    episodeShots.sort((a, b) => {
      const sceneA = sceneOrder[a.scene_id as string] ?? 999;
      const sceneB = sceneOrder[b.scene_id as string] ?? 999;
      if (sceneA !== sceneB) return sceneA - sceneB;
      return ((a.idx as number) || 0) - ((b.idx as number) || 0);
    });

    // Clear existing non-locked clips on video track
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

    // Build occupied ranges from locked clips
    const occupied = (lockedClips || []).map((c) => ({
      start: c.start_time_ms,
      end: c.end_time_ms,
    }));

    // Assembly: place clips sequentially, skipping occupied ranges
    let cursor = 0;
    const clipInserts: Array<Record<string, unknown>> = [];
    const DEFAULT_CLIP_DURATION_MS = 5000;

    // Combine project assets and episode shots
    const allClips = [
      ...(assets || []).map((a) => ({
        name: (a.metadata as Record<string, unknown>)?.name || "Clip",
        duration_ms: ((a.metadata as Record<string, unknown>)?.duration_ms as number) || DEFAULT_CLIP_DURATION_MS,
        asset_id: a.id,
        scene_id: null,
        provider: a.source_provider,
        model: a.source_model,
      })),
      ...episodeShots.map((s) => ({
        name: `Shot #${s.idx}`,
        duration_ms: ((s.duration_sec as number) || 5) * 1000,
        asset_id: null,
        scene_id: s.scene_id as string | null,
        provider: s.provider as string | null,
        model: null,
      })),
    ];

    for (const clip of allClips) {
      // Skip past any occupied range
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

    // Create review gate for rough_cut approval
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

    return new Response(
      JSON.stringify({
        success: true,
        timeline_id: tlId,
        clips_placed: clipInserts.length,
        total_duration_ms: cursor,
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
