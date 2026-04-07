/**
 * Pipeline Definitions — Optimal step sequences per workflow type.
 *
 * Each pipeline defines the ideal sequence of provider steps, the model to use,
 * what output to store, and where to pause for user validation.
 */
import type { PipelineStep, PipelineRoute, ProjectMode } from "./types";

// ── Series Pipeline ─────────────────────────────────────────────────────────
// Backbone: Runway Gen-4.5
// Hero: Veo 3.1
// Acting: Act-Two
// Transform: Aleph
// Identity: Photon / Nano Banana Pro
const SERIES_PIPELINE: PipelineStep[] = [
  {
    step: "identity_pack",
    provider: "luma_photon",
    model: "photon-1",
    outputKey: "character_pack_v1",
    userGate: "approve_character_identity",
    condition: "photos_count >= 2",
    fallback: { provider: "google_nano_banana_pro", model: "gemini-3-pro-image-preview" },
  },
  {
    step: "lookdev",
    provider: "google_nano_banana_pro",
    model: "gemini-3-pro-image-preview",
    outputKey: "character_pack_v1",
    userGate: "approve_character_identity",
    condition: "photos_count < 2",
  },
  {
    step: "world_pack",
    provider: "google_nano_banana_pro",
    model: "gemini-3-pro-image-preview",
    outputKey: "world_bible_v1",
    userGate: "approve_world_bible",
  },
  {
    step: "scene_backbone",
    provider: "runway",
    model: "gen4.5",
    outputKey: "scene_clip_candidates",
    userGate: "approve_scene_plan",
  },
  {
    step: "acting",
    provider: "runway_act_two",
    model: "act_two",
    outputKey: "performance_clips",
    userGate: "approve_performance",
    condition: "needs_speaking_character",
  },
  {
    step: "hero_shots",
    provider: "google_veo_31",
    model: "veo-3.1-generate-preview",
    outputKey: "hero_shots",
    userGate: "approve_hero_shots",
  },
  {
    step: "repair",
    provider: "runway_aleph",
    model: "gen4_aleph",
    outputKey: "patched_clips",
    userGate: "approve_repair",
    condition: "has_failed_shots",
  },
  {
    step: "social_exports",
    provider: "luma_reframe",
    model: "reframe",
    outputKey: "exports_social",
    userGate: "approve_social_exports",
    condition: "needs_social_vertical",
  },
  {
    step: "poster",
    provider: "openai_image",
    model: "gpt-image-1.5",
    outputKey: "poster_assets",
    userGate: "approve_poster",
  },
];

// ── Film Pipeline ───────────────────────────────────────────────────────────
// Like series but more design upfront (Nano Banana Pro earlier)
const FILM_PIPELINE: PipelineStep[] = [
  {
    step: "identity_pack",
    provider: "luma_photon",
    model: "photon-1",
    outputKey: "character_pack_v1",
    userGate: "approve_character_lock",
    condition: "photos_count >= 2",
    fallback: { provider: "google_nano_banana_pro", model: "gemini-3-pro-image-preview" },
  },
  {
    step: "lookdev",
    provider: "google_nano_banana_pro",
    model: "gemini-3-pro-image-preview",
    outputKey: "character_pack_v1",
    userGate: "approve_character_lock",
    condition: "photos_count < 2",
  },
  {
    step: "world_pack",
    provider: "google_nano_banana_pro",
    model: "gemini-3-pro-image-preview",
    outputKey: "film_bible_v1",
    userGate: "approve_film_bible",
  },
  {
    step: "scene_backbone",
    provider: "runway",
    model: "gen4.5",
    outputKey: "sequence_candidates",
    userGate: "approve_sequences",
  },
  {
    step: "acting",
    provider: "runway_act_two",
    model: "act_two",
    outputKey: "acting_clips",
    userGate: "approve_acting",
    condition: "needs_speaking_character",
  },
  {
    step: "hero_shots",
    provider: "google_veo_31",
    model: "veo-3.1-generate-preview",
    outputKey: "prestige_shots",
    userGate: "approve_prestige_shots",
  },
  {
    step: "repair",
    provider: "runway_aleph",
    model: "gen4_aleph",
    outputKey: "patched_sequences",
    userGate: "approve_patches",
    condition: "has_failed_shots",
  },
  {
    step: "social_exports",
    provider: "luma_reframe",
    model: "reframe",
    outputKey: "promo_exports",
    userGate: "approve_promo_exports",
    condition: "needs_social_vertical",
  },
  {
    step: "poster",
    provider: "openai_image",
    model: "gpt-image-1.5",
    outputKey: "poster_assets",
    userGate: "approve_promo_assets",
  },
];

// ── Music Video Pipeline ────────────────────────────────────────────────────
// Veo 3.1 is the backbone (short strong shots)
// Runway for performance and transformation
const MUSIC_VIDEO_PIPELINE: PipelineStep[] = [
  {
    step: "identity_pack",
    provider: "luma_photon",
    model: "photon-1",
    outputKey: "artist_identity_pack",
    userGate: "approve_artist_identity",
    condition: "photos_count >= 2",
    fallback: { provider: "google_nano_banana_2", model: "gemini-3.1-flash-image-preview" },
  },
  {
    step: "lookdev",
    provider: "google_nano_banana_pro",
    model: "gemini-3-pro-image-preview",
    outputKey: "artist_look_lock",
    userGate: "approve_artist_look",
  },
  {
    step: "iconic_shots",
    provider: "google_veo_31",
    model: "veo-3.1-generate-preview",
    outputKey: "iconic_shots",
    userGate: "approve_iconic_shots",
  },
  {
    step: "acting",
    provider: "runway_act_two",
    model: "act_two",
    outputKey: "performance_shots",
    userGate: "approve_performance_shots",
    condition: "has_driving_performance",
  },
  {
    step: "repair",
    provider: "runway_aleph",
    model: "gen4_aleph",
    outputKey: "stylized_clips",
    userGate: "approve_stylization",
    condition: "has_existing_video",
  },
  {
    step: "social_exports",
    provider: "luma_reframe",
    model: "reframe",
    outputKey: "social_cuts",
    userGate: "approve_social_cuts",
    condition: "needs_social_vertical",
  },
  {
    step: "poster",
    provider: "openai_image",
    model: "gpt-image-1.5",
    outputKey: "cover_assets",
    userGate: "approve_cover",
  },
];

// ── Clip Pipeline (lightweight) ─────────────────────────────────────────────
const CLIP_PIPELINE: PipelineStep[] = [
  {
    step: "scene_backbone",
    provider: "runway",
    model: "gen4.5",
    outputKey: "clip_shots",
    userGate: "approve_clip",
    fallback: { provider: "google_veo_31", model: "veo-3.1-generate-preview" },
  },
  {
    step: "poster",
    provider: "openai_image",
    model: "gpt-image-1.5",
    outputKey: "thumbnail",
  },
];

// ── Export ───────────────────────────────────────────────────────────────────

export const PIPELINE_ROUTES: Record<ProjectMode, PipelineRoute> = {
  series: { workflowType: "series", steps: SERIES_PIPELINE },
  film: { workflowType: "film", steps: FILM_PIPELINE },
  music_video: { workflowType: "music_video", steps: MUSIC_VIDEO_PIPELINE },
  clip: { workflowType: "clip", steps: CLIP_PIPELINE },
};

/**
 * Get the pipeline route for a given project mode.
 */
export function getPipelineRoute(mode: ProjectMode): PipelineRoute {
  return PIPELINE_ROUTES[mode] || PIPELINE_ROUTES.clip;
}

/**
 * Filter pipeline steps based on input profile conditions.
 */
export function resolveSteps(
  mode: ProjectMode,
  profile: Record<string, any>
): PipelineStep[] {
  const route = getPipelineRoute(mode);
  return route.steps.filter((step) => {
    if (!step.condition) return true;
    // Simple condition evaluator
    const cond = step.condition;
    if (cond === "photos_count >= 2") return (profile.photos_count ?? 0) >= 2;
    if (cond === "photos_count < 2") return (profile.photos_count ?? 0) < 2;
    if (cond === "needs_speaking_character") return !!profile.needs_speaking_character;
    if (cond === "needs_social_vertical") return !!profile.needs_social_vertical;
    if (cond === "has_failed_shots") return !!profile.has_failed_shots;
    if (cond === "has_driving_performance") return !!profile.has_driving_performance;
    if (cond === "has_existing_video") return !!profile.has_existing_video;
    return true;
  });
}
