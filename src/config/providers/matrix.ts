/**
 * Provider Matrix — mode × tier → ProviderRule
 * Defines which providers are allowed for each project mode and quality tier.
 */
import type { ProjectMode, QualityTier, ProviderRule } from "./types";

/**
 * The matrix: [projectMode][qualityTier] → ProviderRule
 *
 * Priority chains per the architecture spec:
 * - Series/Film backbone: Runway Gen-4.5 → Veo 3.1 → Luma Ray-2
 * - Music Video backbone: Veo 3.1 → Runway Gen-4.5 → Luma Ray-2
 * - Image fallback: Nano Banana Pro → Photon → GPT Image 1.5
 */
export const PROVIDER_MATRIX: Record<ProjectMode, Record<QualityTier, ProviderRule>> = {
  music_video: {
    premium: {
      allowedProviders: ["google_veo_31", "runway", "runway_act_two"],
      acceptableOutputs: ["native_video"],
      allowSilentImageFallback: false,
      renderTarget: "server_required",
      description: "Clip musical premium — Veo 3.1 centre, Runway acting, vidéo native uniquement",
    },
    standard: {
      allowedProviders: ["google_veo_31", "runway", "google_veo_31_lite", "luma"],
      acceptableOutputs: ["native_video", "image_sequence"],
      allowSilentImageFallback: false,
      renderTarget: "server_preferred",
      description: "Clip musical standard — Veo/Runway vidéo, fallback explicite seulement",
    },
    economy: {
      allowedProviders: ["google_veo_31_lite", "luma", "openai_image", "google_nano_banana_2"],
      acceptableOutputs: ["native_video", "image_sequence", "browser_assembly_only"],
      allowSilentImageFallback: true,
      renderTarget: "browser_allowed",
      description: "Clip musical économique — toute source acceptée",
    },
  },
  series: {
    premium: {
      allowedProviders: ["runway", "google_veo_31", "runway_act_two"],
      acceptableOutputs: ["native_video"],
      allowSilentImageFallback: false,
      renderTarget: "server_required",
      description: "Série premium — Runway backbone, Veo hero shots, vidéo native uniquement",
    },
    standard: {
      allowedProviders: ["runway", "google_veo_31", "luma", "google_veo_31_lite"],
      acceptableOutputs: ["native_video", "image_sequence"],
      allowSilentImageFallback: false,
      renderTarget: "server_preferred",
      description: "Série standard — Runway/Veo prioritaires, fallback visible",
    },
    economy: {
      allowedProviders: ["luma", "google_veo_31_lite", "openai_image", "google_nano_banana_2"],
      acceptableOutputs: ["native_video", "image_sequence", "browser_assembly_only"],
      allowSilentImageFallback: true,
      renderTarget: "browser_allowed",
      description: "Série économique — tous modes acceptés",
    },
  },
  film: {
    premium: {
      allowedProviders: ["runway", "google_veo_31", "runway_act_two"],
      acceptableOutputs: ["native_video"],
      allowSilentImageFallback: false,
      renderTarget: "server_required",
      description: "Film premium — Runway backbone, Veo prestige, vidéo native uniquement",
    },
    standard: {
      allowedProviders: ["runway", "google_veo_31", "luma", "google_veo_31_lite"],
      acceptableOutputs: ["native_video", "image_sequence"],
      allowSilentImageFallback: false,
      renderTarget: "server_preferred",
      description: "Film standard — Runway/Veo prioritaires",
    },
    economy: {
      allowedProviders: ["luma", "google_veo_31_lite", "openai_image", "google_nano_banana_2"],
      acceptableOutputs: ["native_video", "image_sequence", "browser_assembly_only"],
      allowSilentImageFallback: true,
      renderTarget: "browser_allowed",
      description: "Film économique — tous modes acceptés",
    },
  },
  clip: {
    premium: {
      allowedProviders: ["runway", "google_veo_31"],
      acceptableOutputs: ["native_video"],
      allowSilentImageFallback: false,
      renderTarget: "server_required",
      description: "Clip premium — vidéo native uniquement",
    },
    standard: {
      allowedProviders: ["runway", "google_veo_31", "luma", "google_veo_31_lite"],
      acceptableOutputs: ["native_video", "image_sequence"],
      allowSilentImageFallback: false,
      renderTarget: "server_preferred",
      description: "Clip standard — fallback image autorisé si visible",
    },
    economy: {
      allowedProviders: ["luma", "google_veo_31_lite", "openai_image", "google_nano_banana_2"],
      acceptableOutputs: ["native_video", "image_sequence", "browser_assembly_only"],
      allowSilentImageFallback: true,
      renderTarget: "browser_allowed",
      description: "Clip économique — tous modes acceptés",
    },
  },
};
