/**
 * Provider Matrix — P0.2
 * Centralized provider resolution for all project types and quality tiers.
 * Every generation MUST pass through resolveProvider() before dispatching.
 */

export type ProjectMode = "clip" | "film" | "music_video" | "series";
export type QualityTier = "premium" | "standard" | "economy";
export type OutputNature = "native_video" | "image_sequence" | "browser_assembly_only";
export type RenderTarget = "server_required" | "server_preferred" | "browser_allowed";

export interface ProviderRule {
  /** Providers allowed (in priority order) */
  allowedProviders: string[];
  /** What kind of output is acceptable */
  acceptableOutputs: OutputNature[];
  /** Whether silent fallback to image-only is allowed */
  allowSilentImageFallback: boolean;
  /** Required render target */
  renderTarget: RenderTarget;
  /** Human description */
  description: string;
}

/**
 * The matrix: [projectMode][qualityTier] → ProviderRule
 */
const PROVIDER_MATRIX: Record<ProjectMode, Record<QualityTier, ProviderRule>> = {
  music_video: {
    premium: {
      allowedProviders: ["runway", "sora2", "google_veo", "luma"],
      acceptableOutputs: ["native_video"],
      allowSilentImageFallback: false,
      renderTarget: "server_required",
      description: "Clip musical premium — vidéo native uniquement, rendu serveur obligatoire",
    },
    standard: {
      allowedProviders: ["runway", "sora2", "google_veo", "luma", "openai_image"],
      acceptableOutputs: ["native_video", "image_sequence"],
      allowSilentImageFallback: false,
      renderTarget: "server_preferred",
      description: "Clip musical standard — vidéo native préférée, image sequence tolérée si explicite",
    },
    economy: {
      allowedProviders: ["openai_image", "runway", "sora2", "google_veo", "luma"],
      acceptableOutputs: ["native_video", "image_sequence", "browser_assembly_only"],
      allowSilentImageFallback: true,
      renderTarget: "browser_allowed",
      description: "Clip musical économique — toute source acceptée",
    },
  },
  clip: {
    premium: {
      allowedProviders: ["runway", "sora2", "google_veo", "luma"],
      acceptableOutputs: ["native_video"],
      allowSilentImageFallback: false,
      renderTarget: "server_required",
      description: "Clip premium — vidéo native uniquement",
    },
    standard: {
      allowedProviders: ["runway", "sora2", "google_veo", "luma", "openai_image"],
      acceptableOutputs: ["native_video", "image_sequence"],
      allowSilentImageFallback: false,
      renderTarget: "server_preferred",
      description: "Clip standard — fallback image autorisé si visible",
    },
    economy: {
      allowedProviders: ["openai_image", "runway", "sora2", "google_veo", "luma"],
      acceptableOutputs: ["native_video", "image_sequence", "browser_assembly_only"],
      allowSilentImageFallback: true,
      renderTarget: "browser_allowed",
      description: "Clip économique — tous modes acceptés",
    },
  },
  film: {
    premium: {
      allowedProviders: ["runway", "sora2", "google_veo", "luma"],
      acceptableOutputs: ["native_video"],
      allowSilentImageFallback: false,
      renderTarget: "server_required",
      description: "Film premium — vidéo native uniquement",
    },
    standard: {
      allowedProviders: ["runway", "sora2", "google_veo", "luma", "openai_image"],
      acceptableOutputs: ["native_video", "image_sequence"],
      allowSilentImageFallback: false,
      renderTarget: "server_preferred",
      description: "Film standard",
    },
    economy: {
      allowedProviders: ["openai_image", "runway", "sora2", "google_veo", "luma"],
      acceptableOutputs: ["native_video", "image_sequence", "browser_assembly_only"],
      allowSilentImageFallback: true,
      renderTarget: "browser_allowed",
      description: "Film économique",
    },
  },
  series: {
    premium: {
      allowedProviders: ["runway", "luma"],
      acceptableOutputs: ["native_video"],
      allowSilentImageFallback: false,
      renderTarget: "server_required",
      description: "Série premium — vidéo native uniquement",
    },
    standard: {
      allowedProviders: ["runway", "luma", "openai_image"],
      acceptableOutputs: ["native_video", "image_sequence"],
      allowSilentImageFallback: false,
      renderTarget: "server_preferred",
      description: "Série standard",
    },
    economy: {
      allowedProviders: ["openai_image", "runway", "luma"],
      acceptableOutputs: ["native_video", "image_sequence", "browser_assembly_only"],
      allowSilentImageFallback: true,
      renderTarget: "browser_allowed",
      description: "Série économique",
    },
  },
};

export interface ProviderResolution {
  rule: ProviderRule;
  selectedProvider: string | null;
  outputNature: OutputNature | null;
  blocked: boolean;
  blockReason: string | null;
  fallbackUsed: boolean;
  decisionLog: string[];
}

/**
 * Resolve which provider to use for a given project configuration.
 * @param mode - Project mode (clip, film, music_video, series)
 * @param tier - Quality tier (premium, standard, economy)
 * @param availableProviders - List of currently healthy provider names
 * @returns Resolution result with selected provider or block reason
 */
export function resolveProvider(
  mode: ProjectMode,
  tier: QualityTier,
  availableProviders: string[]
): ProviderResolution {
  const rule = PROVIDER_MATRIX[mode]?.[tier];
  if (!rule) {
    return {
      rule: PROVIDER_MATRIX.clip.standard,
      selectedProvider: null,
      outputNature: null,
      blocked: true,
      blockReason: `Unknown mode/tier combination: ${mode}/${tier}`,
      fallbackUsed: false,
      decisionLog: [`ERROR: No rule found for ${mode}/${tier}`],
    };
  }

  const log: string[] = [];
  log.push(`Resolving provider for ${mode}/${tier}`);
  log.push(`Allowed providers: ${rule.allowedProviders.join(", ")}`);
  log.push(`Available providers: ${availableProviders.join(", ") || "none"}`);

  // Find first allowed provider that is available
  let selectedProvider: string | null = null;
  let outputNature: OutputNature | null = null;
  let fallbackUsed = false;

  for (const p of rule.allowedProviders) {
    if (availableProviders.includes(p)) {
      selectedProvider = p;
      outputNature = p === "openai_image" ? "image_sequence" : "native_video";
      // mock provider uses image_sequence too
      if (p === "mock") outputNature = "image_sequence";
      fallbackUsed = p !== rule.allowedProviders[0];
      log.push(`Selected: ${p} (${outputNature})${fallbackUsed ? " [FALLBACK]" : ""}`);
      break;
    }
    log.push(`Skipped ${p}: not available`);
  }

  // Check if the output nature is acceptable
  if (selectedProvider && outputNature && !rule.acceptableOutputs.includes(outputNature)) {
    log.push(`BLOCKED: ${outputNature} not acceptable for ${mode}/${tier}`);
    return {
      rule,
      selectedProvider: null,
      outputNature: null,
      blocked: true,
      blockReason: `Output ${outputNature} not acceptable for ${mode}/${tier}. Required: ${rule.acceptableOutputs.join(", ")}`,
      fallbackUsed,
      decisionLog: log,
    };
  }

  // Check silent fallback policy
  if (fallbackUsed && outputNature === "image_sequence" && !rule.allowSilentImageFallback) {
    log.push(`WARNING: Image fallback used but silent fallback not allowed — will be flagged in UI`);
  }

  if (!selectedProvider) {
    log.push(`BLOCKED: No available provider matches the requirements`);
    return {
      rule,
      selectedProvider: null,
      outputNature: null,
      blocked: true,
      blockReason: `Aucun provider disponible pour ${mode}/${tier}. Requis: ${rule.allowedProviders.join(", ")}`,
      fallbackUsed: false,
      decisionLog: log,
    };
  }

  return {
    rule,
    selectedProvider,
    outputNature,
    blocked: false,
    blockReason: null,
    fallbackUsed,
    decisionLog: log,
  };
}

/**
 * Get the render target for a given project configuration.
 */
export function getRenderTarget(mode: ProjectMode, tier: QualityTier): RenderTarget {
  return PROVIDER_MATRIX[mode]?.[tier]?.renderTarget ?? "browser_allowed";
}

/**
 * Check if browser rendering is allowed for this project config.
 */
export function isBrowserRenderAllowed(mode: ProjectMode, tier: QualityTier): boolean {
  const target = getRenderTarget(mode, tier);
  return target === "browser_allowed";
}

export { PROVIDER_MATRIX };
