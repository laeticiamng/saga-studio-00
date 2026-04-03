/**
 * Pipeline State Machine — P0.4
 * Strict state machine for project pipeline transitions.
 * Every status update MUST go through this module.
 */

export const PIPELINE_STATES = [
  "draft",
  "validating_inputs",
  "analyzing_audio",
  "planning_storyboard",
  "resolving_provider",
  "generating_shots",
  "quality_review",
  "rendering",
  "export_ready",
  "completed",
  "failed_retryable",
  "failed_terminal",
  "cancelled",
] as const;

export type PipelineState = (typeof PIPELINE_STATES)[number];

/** Legacy status mapping for backward compat */
export const LEGACY_TO_NEW: Record<string, PipelineState> = {
  draft: "draft",
  analyzing: "analyzing_audio",
  planning: "planning_storyboard",
  generating: "generating_shots",
  stitching: "rendering",
  completed: "completed",
  failed: "failed_retryable",
  cancelled: "cancelled",
};

export const NEW_TO_LEGACY: Record<PipelineState, string> = {
  draft: "draft",
  validating_inputs: "analyzing",
  analyzing_audio: "analyzing",
  planning_storyboard: "planning",
  resolving_provider: "planning",
  generating_shots: "generating",
  quality_review: "generating",
  rendering: "stitching",
  export_ready: "completed",
  completed: "completed",
  failed_retryable: "failed",
  failed_terminal: "failed",
  cancelled: "cancelled",
};

/** Allowed transitions map */
const TRANSITIONS: Record<PipelineState, PipelineState[]> = {
  draft: ["validating_inputs", "analyzing_audio", "cancelled"],
  validating_inputs: ["analyzing_audio", "failed_retryable", "failed_terminal", "cancelled"],
  analyzing_audio: ["planning_storyboard", "failed_retryable", "failed_terminal", "cancelled"],
  planning_storyboard: ["resolving_provider", "failed_retryable", "failed_terminal", "cancelled"],
  resolving_provider: ["generating_shots", "failed_retryable", "failed_terminal", "cancelled"],
  generating_shots: ["quality_review", "rendering", "failed_retryable", "failed_terminal", "cancelled"],
  quality_review: ["generating_shots", "rendering", "failed_retryable", "failed_terminal", "cancelled"],
  rendering: ["export_ready", "completed", "failed_retryable", "failed_terminal", "cancelled"],
  export_ready: ["completed", "cancelled"],
  completed: [],
  failed_retryable: ["draft", "validating_inputs", "analyzing_audio", "planning_storyboard", "resolving_provider", "generating_shots", "rendering", "cancelled"],
  failed_terminal: [],
  cancelled: [],
};

/** Error codes for pipeline failures */
export const ERROR_CODES = {
  INSUFFICIENT_CREDITS: "E001",
  NO_AUDIO: "E002",
  INVALID_AUDIO_FORMAT: "E003",
  PROVIDER_UNAVAILABLE: "E004",
  PROVIDER_RATE_LIMIT: "E005",
  PROVIDER_POLICY_VIOLATION: "E006",
  ALL_SHOTS_FAILED: "E007",
  RENDER_SERVICE_DOWN: "E008",
  RENDER_TIMEOUT: "E009",
  QUALITY_BELOW_THRESHOLD: "E010",
  CONTINUITY_VIOLATION: "E011",
  INVALID_TRANSITION: "E012",
  UNKNOWN: "E999",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface TransitionResult {
  allowed: boolean;
  from: PipelineState;
  to: PipelineState;
  errorCode?: ErrorCode;
  errorMessage?: string;
}

/**
 * Check if a transition is valid.
 */
export function canTransition(from: PipelineState, to: PipelineState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Attempt a pipeline state transition. Returns result with success/failure info.
 */
export function transition(from: PipelineState, to: PipelineState): TransitionResult {
  if (canTransition(from, to)) {
    return { allowed: true, from, to };
  }
  return {
    allowed: false,
    from,
    to,
    errorCode: ERROR_CODES.INVALID_TRANSITION,
    errorMessage: `Transition non autorisée: ${from} → ${to}. Transitions valides depuis ${from}: ${TRANSITIONS[from]?.join(", ") || "aucune"}`,
  };
}

/**
 * Get the last stable checkpoint state to resume from after a retryable failure.
 */
export function getResumePoint(failedAt: PipelineState): PipelineState {
  const resumeMap: Partial<Record<PipelineState, PipelineState>> = {
    validating_inputs: "draft",
    analyzing_audio: "draft",
    planning_storyboard: "analyzing_audio",
    resolving_provider: "planning_storyboard",
    generating_shots: "resolving_provider",
    quality_review: "generating_shots",
    rendering: "generating_shots",
    export_ready: "rendering",
  };
  return resumeMap[failedAt] ?? "draft";
}

/**
 * Check if a state is terminal (no further transitions possible).
 */
export function isTerminal(state: PipelineState): boolean {
  return TRANSITIONS[state]?.length === 0;
}

/**
 * Check if a state is an active processing state.
 */
export function isActive(state: PipelineState): boolean {
  return [
    "validating_inputs",
    "analyzing_audio",
    "planning_storyboard",
    "resolving_provider",
    "generating_shots",
    "quality_review",
    "rendering",
  ].includes(state);
}

/**
 * Convert legacy status string to new PipelineState.
 */
export function fromLegacy(legacyStatus: string): PipelineState {
  return LEGACY_TO_NEW[legacyStatus] ?? "draft";
}

/**
 * Convert PipelineState to legacy status string for DB compat.
 */
export function toLegacy(state: PipelineState): string {
  return NEW_TO_LEGACY[state] ?? "draft";
}

/** Human-readable labels for each state */
export const STATE_LABELS: Record<PipelineState, string> = {
  draft: "Brouillon",
  validating_inputs: "Validation des entrées…",
  analyzing_audio: "Analyse audio…",
  planning_storyboard: "Planification storyboard…",
  resolving_provider: "Résolution provider…",
  generating_shots: "Génération des plans…",
  quality_review: "Revue qualité…",
  rendering: "Rendu vidéo…",
  export_ready: "Prêt à exporter",
  completed: "Terminé",
  failed_retryable: "Échec (relançable)",
  failed_terminal: "Échec définitif",
  cancelled: "Annulé",
};
