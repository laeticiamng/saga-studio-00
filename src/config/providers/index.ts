/**
 * Provider System — Public API
 *
 * Import everything from here:
 *   import { resolveProvider, PROVIDER_MODELS, getPipelineRoute } from "@/config/providers";
 */

// Types
export type {
  ProjectMode,
  QualityTier,
  OutputNature,
  RenderTarget,
  ProviderCapability,
  PipelineStepRole,
  ProviderModel,
  ProviderRule,
  ProviderResolution,
  PipelineStep,
  PipelineRoute,
} from "./types";

// Registry
export {
  PROVIDER_MODELS,
  getActiveProviders,
  getProvidersByCapability,
  getVideoProviders,
  getImageProviders,
} from "./registry";

// Matrix
export { PROVIDER_MATRIX } from "./matrix";

// Resolver
export {
  resolveProvider,
  getRenderTarget,
  isBrowserRenderAllowed,
} from "./resolver";

// Pipelines
export {
  PIPELINE_ROUTES,
  getPipelineRoute,
  resolveSteps,
} from "./pipelines";
