/**
 * Provider Registry — Static catalog of all known provider models and their capabilities.
 */
import type { ProviderModel } from "./types";

export const PROVIDER_MODELS: Record<string, ProviderModel> = {
  // ── Google Image ──────────────────────────────────────────────────────────
  google_nano_banana_2: {
    name: "google_nano_banana_2",
    displayName: "Nano Banana 2 (Image rapide)",
    brand: "google",
    outputType: "image",
    modelId: "gemini-3.1-flash-image-preview",
    capabilities: ["text_to_image", "image_reference"],
    maxDurationSec: null,
    costPerSecond: 0.01,
    status: "active",
  },
  google_nano_banana_pro: {
    name: "google_nano_banana_pro",
    displayName: "Nano Banana Pro (Image premium)",
    brand: "google",
    outputType: "image",
    modelId: "gemini-3-pro-image-preview",
    capabilities: ["text_to_image", "text_rendering", "image_reference"],
    maxDurationSec: null,
    costPerSecond: 0.03,
    status: "active",
  },

  // ── Google Video ──────────────────────────────────────────────────────────
  google_veo_31: {
    name: "google_veo_31",
    displayName: "Veo 3.1 (Hero shots)",
    brand: "google",
    outputType: "video",
    modelId: "veo-3.1-generate-preview",
    capabilities: ["text_to_video", "image_reference"],
    maxDurationSec: 8,
    costPerSecond: 0.10,
    status: "active",
  },
  google_veo_31_lite: {
    name: "google_veo_31_lite",
    displayName: "Veo 3.1 Lite (Itérations)",
    brand: "google",
    outputType: "video",
    modelId: "veo-3.1-lite-generate-preview",
    capabilities: ["text_to_video"],
    maxDurationSec: 8,
    costPerSecond: 0.05,
    status: "active",
  },
  google_veo: {
    name: "google_veo",
    displayName: "Veo 3.0 (DEPRECATED)",
    brand: "google",
    outputType: "video",
    modelId: "veo-3.0-generate-preview",
    capabilities: ["text_to_video"],
    maxDurationSec: 8,
    costPerSecond: 0.08,
    status: "deprecated",
  },

  // ── Runway ────────────────────────────────────────────────────────────────
  runway: {
    name: "runway",
    displayName: "Runway Gen-4.5 (Backbone narratif)",
    brand: "runway",
    outputType: "video",
    modelId: "gen4.5",
    capabilities: ["text_to_video", "image_to_video"],
    maxDurationSec: 10,
    costPerSecond: 0.40,
    status: "active",
  },
  runway_act_two: {
    name: "runway_act_two",
    displayName: "Runway Act-Two (Performance)",
    brand: "runway",
    outputType: "video",
    modelId: "act_two",
    capabilities: ["performance_capture"],
    maxDurationSec: 10,
    costPerSecond: 0.50,
    status: "active",
  },
  runway_aleph: {
    name: "runway_aleph",
    displayName: "Runway Gen-4 Aleph (Transform)",
    brand: "runway",
    outputType: "video",
    modelId: "gen4_aleph",
    capabilities: ["video_to_video", "style_transfer"],
    maxDurationSec: 10,
    costPerSecond: 0.45,
    status: "active",
  },

  // ── Luma ──────────────────────────────────────────────────────────────────
  luma_photon: {
    name: "luma_photon",
    displayName: "Luma Photon-1 (Identity pack)",
    brand: "luma",
    outputType: "image",
    modelId: "photon-1",
    capabilities: ["text_to_image", "character_reference", "style_reference", "image_reference"],
    maxDurationSec: null,
    costPerSecond: 0.02,
    status: "active",
  },
  luma_photon_flash: {
    name: "luma_photon_flash",
    displayName: "Luma Photon Flash (Image rapide)",
    brand: "luma",
    outputType: "image",
    modelId: "photon-flash-1",
    capabilities: ["text_to_image", "character_reference"],
    maxDurationSec: null,
    costPerSecond: 0.01,
    status: "active",
  },
  luma: {
    name: "luma",
    displayName: "Luma Ray-2 (Vidéo utilitaire)",
    brand: "luma",
    outputType: "video",
    modelId: "ray-2",
    capabilities: ["text_to_video"],
    maxDurationSec: 10,
    costPerSecond: 0.30,
    status: "active",
  },
  luma_reframe: {
    name: "luma_reframe",
    displayName: "Luma Reframe (Recadrage)",
    brand: "luma",
    outputType: "utility",
    modelId: "reframe",
    capabilities: ["video_reframe"],
    maxDurationSec: null,
    costPerSecond: 0.05,
    status: "active",
  },
  luma_modify: {
    name: "luma_modify",
    displayName: "Luma Modify Video",
    brand: "luma",
    outputType: "utility",
    modelId: "modify_video",
    capabilities: ["video_modify", "style_transfer"],
    maxDurationSec: 10,
    costPerSecond: 0.08,
    status: "active",
  },

  // ── OpenAI ────────────────────────────────────────────────────────────────
  openai_image: {
    name: "openai_image",
    displayName: "OpenAI GPT Image 1.5",
    brand: "openai",
    outputType: "image",
    modelId: "gpt-image-1.5",
    capabilities: ["text_to_image", "text_rendering"],
    maxDurationSec: null,
    costPerSecond: 0.02,
    status: "active",
  },
  sora2: {
    name: "sora2",
    displayName: "OpenAI Sora 2 (LEGACY)",
    brand: "openai",
    outputType: "video",
    modelId: "sora-2",
    capabilities: ["text_to_video"],
    maxDurationSec: 20,
    costPerSecond: 0.10,
    status: "legacy",
  },
};

/** Get only active (non-deprecated, non-legacy) providers */
export function getActiveProviders(): ProviderModel[] {
  return Object.values(PROVIDER_MODELS).filter((p) => p.status === "active");
}

/** Get providers by capability */
export function getProvidersByCapability(cap: string): ProviderModel[] {
  return getActiveProviders().filter((p) =>
    p.capabilities.includes(cap as any)
  );
}

/** Get video providers only */
export function getVideoProviders(): ProviderModel[] {
  return getActiveProviders().filter((p) => p.outputType === "video");
}

/** Get image providers only */
export function getImageProviders(): ProviderModel[] {
  return getActiveProviders().filter((p) => p.outputType === "image");
}
