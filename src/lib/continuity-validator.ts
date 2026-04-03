/**
 * Continuity Validator — P1.3
 * Detect visual inconsistencies between consecutive shots.
 */

export interface ContinuityCheck {
  dimension: string;
  label: string;
  shotA: number;
  shotB: number;
  score: number; // 0-1 (1 = perfect continuity)
  severity: "error" | "warning" | "info";
  description: string;
}

export interface ContinuityReport {
  projectId: string;
  checks: ContinuityCheck[];
  globalScore: number;
  errorCount: number;
  warningCount: number;
  retrySuggestions: { shotIdx: number; reason: string }[];
}

const CONTINUITY_DIMENSIONS = [
  { key: "face", label: "Visage" },
  { key: "hair", label: "Cheveux" },
  { key: "clothing", label: "Vêtements" },
  { key: "lighting", label: "Éclairage" },
  { key: "palette", label: "Palette couleurs" },
  { key: "decor", label: "Décor" },
  { key: "props", label: "Accessoires" },
  { key: "framing", label: "Cadrage" },
] as const;

function severityFromScore(score: number): "error" | "warning" | "info" {
  if (score < 0.3) return "error";
  if (score < 0.6) return "warning";
  return "info";
}

/**
 * Validate continuity between consecutive shots.
 * In production, this would use AI vision comparison.
 * For now, it provides the validation framework with pluggable scores.
 */
export function validateContinuity(
  projectId: string,
  shotPairScores: Array<{
    shotA: number;
    shotB: number;
    scores: Partial<Record<string, number>>;
  }>
): ContinuityReport {
  const checks: ContinuityCheck[] = [];
  const retrySuggestions: { shotIdx: number; reason: string }[] = [];

  for (const pair of shotPairScores) {
    for (const dim of CONTINUITY_DIMENSIONS) {
      const score = pair.scores[dim.key] ?? 0.8;
      const severity = severityFromScore(score);

      checks.push({
        dimension: dim.key,
        label: dim.label,
        shotA: pair.shotA,
        shotB: pair.shotB,
        score,
        severity,
        description: score < 0.6
          ? `Incohérence ${dim.label.toLowerCase()} entre plans ${pair.shotA} et ${pair.shotB}`
          : `${dim.label} cohérent entre plans ${pair.shotA} et ${pair.shotB}`,
      });

      if (severity === "error") {
        const existing = retrySuggestions.find(r => r.shotIdx === pair.shotB);
        if (!existing) {
          retrySuggestions.push({
            shotIdx: pair.shotB,
            reason: `Incohérence ${dim.label.toLowerCase()} critique avec le plan précédent`,
          });
        }
      }
    }
  }

  const globalScore = checks.length > 0
    ? checks.reduce((sum, c) => sum + c.score, 0) / checks.length
    : 1;

  return {
    projectId,
    checks,
    globalScore,
    errorCount: checks.filter(c => c.severity === "error").length,
    warningCount: checks.filter(c => c.severity === "warning").length,
    retrySuggestions,
  };
}

export { CONTINUITY_DIMENSIONS };
