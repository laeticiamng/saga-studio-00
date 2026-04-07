/**
 * Provider Types — Centralized type definitions for the provider system.
 */

export type ProjectMode = "clip" | "film" | "music_video" | "series";
export type QualityTier = "premium" | "standard" | "economy";
export type RenderTarget = "server_required" | "server_preferred" | "browser_allowed";

/** What a provider produces */
export type OutputNature = "native_video" | "image_sequence" | "browser_assembly_only";

/** What capability a provider offers */
export type ProviderCapability =
  | "text_to_video"
  | "image_to_video"
  | "video_to_video"
  | "text_to_image"
  | "image_reference"
  | "character_reference"
  | "style_reference"
  | "performance_capture"
  | "video_reframe"
  | "video_modify"
  | "style_transfer"
  | "text_rendering";

/** Role a provider plays in a pipeline step */
export type PipelineStepRole =
  | "identity_pack"
  | "world_pack"
  | "scene_backbone"
  | "acting"
  | "hero_shots"
  | "repair"
  | "social_exports"
  | "poster"
  | "lookdev"
  | "iconic_shots";

export interface ProviderModel {
  /** Internal name used in DB and API calls */
  name: string;
  /** Human-readable name */
  displayName: string;
  /** Provider brand */
  brand: "google" | "runway" | "luma" | "openai";
  /** What kind of output it produces */
  outputType: "video" | "image" | "utility";
  /** Actual model identifier for API calls */
  modelId: string;
  /** What it can do */
  capabilities: ProviderCapability[];
  /** Max output duration in seconds (null for images) */
  maxDurationSec: number | null;
  /** Cost per second of output (or per image) */
  costPerSecond: number;
  /** Whether this provider is legacy/deprecated */
  status: "active" | "legacy" | "deprecated";
}

export interface ProviderRule {
  allowedProviders: string[];
  acceptableOutputs: OutputNature[];
  allowSilentImageFallback: boolean;
  renderTarget: RenderTarget;
  description: string;
}

export interface ProviderResolution {
  rule: ProviderRule;
  selectedProvider: string | null;
  outputNature: OutputNature | null;
  blocked: boolean;
  blockReason: string | null;
  fallbackUsed: boolean;
  decisionLog: string[];
}

export interface PipelineStep {
  step: PipelineStepRole;
  provider: string;
  model: string;
  outputKey: string;
  userGate?: string;
  /** Condition for this step to execute */
  condition?: string;
  /** Fallback provider/model if primary fails */
  fallback?: { provider: string; model: string };
}

export interface PipelineRoute {
  workflowType: ProjectMode;
  steps: PipelineStep[];
}
