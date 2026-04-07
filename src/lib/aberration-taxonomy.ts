/**
 * Aberration Taxonomy — Type-safe taxonomy for AI generation anomalies.
 */

export const ABERRATION_CATEGORIES = [
  "anatomy", "object", "temporal", "physics", "semantic",
  "identity", "framing", "text_graphic", "audio",
] as const;

export type AberrationCategory = (typeof ABERRATION_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<AberrationCategory, string> = {
  anatomy: "Anatomie / Corps",
  object: "Objets",
  temporal: "Temporel / Vidéo",
  physics: "Physique / Causalité",
  semantic: "Sémantique / Script",
  identity: "Identité / Continuité",
  framing: "Cadrage / Composition",
  text_graphic: "Texte / Graphisme",
  audio: "Audio / AV",
};

export const SEVERITY_LEVELS = ["info", "minor", "moderate", "major", "blocking"] as const;
export type AberrationSeverity = (typeof SEVERITY_LEVELS)[number];

export const SEVERITY_WEIGHT: Record<AberrationSeverity, number> = {
  info: 0, minor: 1, moderate: 3, major: 7, blocking: 15,
};

export const REPAIR_ACTIONS = [
  "regenerate", "regenerate_locked_refs", "repair_rerender",
  "reframe", "split_and_simplify", "switch_provider", "manual_review",
] as const;
export type RepairAction = (typeof REPAIR_ACTIONS)[number];

export const REPAIR_ACTION_LABELS: Record<RepairAction, string> = {
  regenerate: "Régénérer",
  regenerate_locked_refs: "Régénérer (refs verrouillées)",
  repair_rerender: "Réparer / Re-rendu",
  reframe: "Recadrer",
  split_and_simplify: "Découper et simplifier",
  switch_provider: "Changer de provider",
  manual_review: "Revue manuelle",
};

export type ValidationStatus = "pending" | "running" | "passed" | "failed" | "blocked";

export interface ValidationScores {
  anatomy: number | null;
  temporal: number | null;
  semantic: number | null;
  continuity: number | null;
  av: number | null;
  framing: number | null;
  final: number | null;
}

/** Compute a final acceptance score from individual scores */
export function computeFinalScore(scores: ValidationScores): number {
  const values = Object.values(scores).filter((v): v is number => v !== null);
  if (values.length === 0) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}

/** Determine validation status from anomaly severities */
export function deriveValidationStatus(
  anomalySeverities: AberrationSeverity[]
): ValidationStatus {
  if (anomalySeverities.some((s) => s === "blocking")) return "blocked";
  if (anomalySeverities.some((s) => s === "major")) return "failed";
  return "passed";
}
