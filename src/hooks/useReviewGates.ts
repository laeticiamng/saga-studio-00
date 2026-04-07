import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ─── Gate Dependency Graph ──────────────────────────────────────────────────
// Downstream gates that must be invalidated when an upstream gate is rejected/regenerated

const GATE_DEPENDENCIES: Record<string, string[]> = {
  character_pack: ["world_pack", "scene_plan", "clips", "rough_cut", "fine_cut", "final_export"],
  world_pack: ["scene_plan", "clips", "rough_cut", "fine_cut", "final_export"],
  scene_plan: ["clips", "rough_cut", "fine_cut", "final_export"],
  clips: ["rough_cut", "fine_cut", "final_export"],
  rough_cut: ["fine_cut", "final_export"],
  fine_cut: ["final_export"],
  hero_shots: [],
  performance: [],
  repair: [],
  social_exports: [],
  poster: [],
  final_export: [],
};

export function useReviewGates(projectId: string | undefined, episodeId?: string) {
  return useQuery({
    queryKey: ["review_gates", projectId, episodeId],
    queryFn: async () => {
      if (!projectId) return [];
      let q = supabase.from("review_gates").select("*").eq("project_id", projectId);
      if (episodeId) q = q.eq("episode_id", episodeId);
      const { data, error } = await q.order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
}

export function useCreateReviewGate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { project_id: string; episode_id?: string; scene_id?: string; gate_type: string }) => {
      const { data, error } = await supabase.from("review_gates").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["review_gates", data.project_id] });
    },
  });
}

export function useDecideReviewGate() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, action, notes }: { id: string; status: string; action?: string; notes?: string }) => {
      // 1. Update the gate itself
      const { data, error } = await supabase
        .from("review_gates")
        .update({
          status,
          decision_action: action,
          decided_by: user?.id,
          decided_at: new Date().toISOString(),
          notes,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;

      // 2. On rejection or regeneration → invalidate downstream gates
      if (status === "rejected" || status === "regenerating") {
        const gateType = data.gate_type as string;
        const downstreamTypes = GATE_DEPENDENCIES[gateType] || [];

        if (downstreamTypes.length > 0) {
          const { error: cascadeErr } = await supabase
            .from("review_gates")
            .update({
              status: "stale",
              notes: `Invalidé automatiquement : ${gateType} a été ${status === "rejected" ? "rejeté" : "régénéré"}`,
            })
            .eq("project_id", data.project_id)
            .in("gate_type", downstreamTypes)
            .in("status", ["approved", "pending"]);

          if (cascadeErr) console.error("Cascade invalidation error:", cascadeErr);
        }
      }

      // 3. On rough_cut approval → lock all timeline clips
      if (status === "approved" && data.gate_type === "rough_cut") {
        await lockTimelineClips(data.project_id as string);
      }

      // 4. On fine_cut approval → lock the timeline itself
      if (status === "approved" && data.gate_type === "fine_cut") {
        await lockTimeline(data.project_id as string);
      }

      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["review_gates", data.project_id] });
      qc.invalidateQueries({ queryKey: ["timelines"] });
      qc.invalidateQueries({ queryKey: ["timeline_clips"] });
    },
  });
}

// ─── Timeline Locking Helpers ───────────────────────────────────────────────

async function lockTimelineClips(projectId: string) {
  // Get the active timeline
  const { data: timelines } = await supabase
    .from("timelines")
    .select("id")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1);

  if (!timelines?.length) return;

  const timelineId = timelines[0].id;

  // Get all tracks for this timeline
  const { data: tracks } = await supabase
    .from("timeline_tracks")
    .select("id")
    .eq("timeline_id", timelineId);

  if (!tracks?.length) return;

  // Lock all clips on all tracks
  for (const track of tracks) {
    await supabase
      .from("timeline_clips")
      .update({ locked: true })
      .eq("track_id", track.id);
  }
}

async function lockTimeline(projectId: string) {
  // Lock the latest timeline
  const { data: timelines } = await supabase
    .from("timelines")
    .select("id")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1);

  if (!timelines?.length) return;

  await supabase
    .from("timelines")
    .update({ status: "locked" })
    .eq("id", timelines[0].id);
}

// ─── Utility: Check if a gate type can proceed ─────────────────────────────

export function useCanProceedGate(projectId: string | undefined, gateType: string) {
  const { data: gates } = useReviewGates(projectId);

  if (!gates) return { canProceed: false, reason: "Loading..." };

  // Find upstream dependencies (reverse lookup)
  const upstreamTypes: string[] = [];
  for (const [upstream, downstreams] of Object.entries(GATE_DEPENDENCIES)) {
    if (downstreams.includes(gateType)) {
      upstreamTypes.push(upstream);
    }
  }

  // Check all upstream gates are approved
  for (const upType of upstreamTypes) {
    const upGate = gates.find((g) => (g as Record<string, unknown>).gate_type === upType);
    if (upGate && (upGate as Record<string, unknown>).status !== "approved") {
      return {
        canProceed: false,
        reason: `"${upType}" doit être approuvé avant "${gateType}"`,
      };
    }
  }

  return { canProceed: true, reason: null };
}
