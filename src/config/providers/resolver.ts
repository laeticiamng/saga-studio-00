/**
 * Provider Resolver — Centralized provider selection logic.
 */
import type {
  ProjectMode,
  QualityTier,
  OutputNature,
  RenderTarget,
  ProviderResolution,
} from "./types";
import { PROVIDER_MATRIX } from "./matrix";
import { PROVIDER_MODELS } from "./registry";

/**
 * Resolve which provider to use for a given project configuration.
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

  let selectedProvider: string | null = null;
  let outputNature: OutputNature | null = null;
  let fallbackUsed = false;

  for (const p of rule.allowedProviders) {
    if (availableProviders.includes(p)) {
      selectedProvider = p;
      const model = PROVIDER_MODELS[p];
      outputNature =
        model?.outputType === "image" ? "image_sequence" : "native_video";
      fallbackUsed = p !== rule.allowedProviders[0];
      log.push(
        `Selected: ${p} (${outputNature})${fallbackUsed ? " [FALLBACK]" : ""}`
      );
      break;
    }
    log.push(`Skipped ${p}: not available`);
  }

  // Check if the output nature is acceptable
  if (
    selectedProvider &&
    outputNature &&
    !rule.acceptableOutputs.includes(outputNature)
  ) {
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
  if (
    fallbackUsed &&
    outputNature === "image_sequence" &&
    !rule.allowSilentImageFallback
  ) {
    log.push(
      `WARNING: Image fallback used but silent fallback not allowed — will be flagged in UI`
    );
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
export function getRenderTarget(
  mode: ProjectMode,
  tier: QualityTier
): RenderTarget {
  return PROVIDER_MATRIX[mode]?.[tier]?.renderTarget ?? "browser_allowed";
}

/**
 * Check if browser rendering is allowed for this project config.
 */
export function isBrowserRenderAllowed(
  mode: ProjectMode,
  tier: QualityTier
): boolean {
  return getRenderTarget(mode, tier) === "browser_allowed";
}
