/**
 * Quality Scoring — P1.2
 * Score each shot and compute global quality score for a project.
 */

export interface ShotQualityDimension {
  dimension: string;
  score: number; // 0-1
  weight: number;
  details?: string;
}

export interface ShotQualityScore {
  shotId: string;
  shotIdx: number;
  dimensions: ShotQualityDimension[];
  globalScore: number; // weighted average 0-1
  needsReview: boolean;
  needsRegeneration: boolean;
}

export interface ProjectQualityScore {
  projectId: string;
  shots: ShotQualityScore[];
  globalScore: number;
  passesThreshold: boolean;
  shotsNeedingReview: number;
  shotsNeedingRegeneration: number;
}

const QUALITY_DIMENSIONS = [
  { key: "face_consistency", label: "Cohérence visage", weight: 0.20 },
  { key: "outfit_consistency", label: "Cohérence tenue", weight: 0.10 },
  { key: "decor_consistency", label: "Cohérence décor", weight: 0.10 },
  { key: "color_palette", label: "Palette couleurs", weight: 0.10 },
  { key: "style_stability", label: "Stabilité du style", weight: 0.15 },
  { key: "sharpness", label: "Netteté / artefacts", weight: 0.10 },
  { key: "beat_match", label: "Adéquation au beat", weight: 0.15 },
  { key: "section_relevance", label: "Pertinence section musicale", weight: 0.10 },
] as const;

const DEFAULT_THRESHOLD = 0.65;
const REVIEW_THRESHOLD = 0.50;
const REGEN_THRESHOLD = 0.35;

/**
 * Score a single shot. In production, this would call an AI vision model.
 * For now, provides the scoring framework.
 */
export function scoreShotQuality(
  shotId: string,
  shotIdx: number,
  dimensionScores: Partial<Record<string, number>>
): ShotQualityScore {
  const dimensions: ShotQualityDimension[] = QUALITY_DIMENSIONS.map(dim => ({
    dimension: dim.key,
    score: dimensionScores[dim.key] ?? 0.7, // Default if not evaluated
    weight: dim.weight,
    details: undefined,
  }));

  const globalScore = dimensions.reduce((sum, d) => sum + d.score * d.weight, 0);

  return {
    shotId,
    shotIdx,
    dimensions,
    globalScore,
    needsReview: globalScore < REVIEW_THRESHOLD,
    needsRegeneration: globalScore < REGEN_THRESHOLD,
  };
}

/**
 * Compute project-level quality score from all shot scores.
 */
export function scoreProjectQuality(
  projectId: string,
  shots: ShotQualityScore[],
  threshold = DEFAULT_THRESHOLD
): ProjectQualityScore {
  const globalScore = shots.length > 0
    ? shots.reduce((sum, s) => sum + s.globalScore, 0) / shots.length
    : 0;

  return {
    projectId,
    shots,
    globalScore,
    passesThreshold: globalScore >= threshold,
    shotsNeedingReview: shots.filter(s => s.needsReview).length,
    shotsNeedingRegeneration: shots.filter(s => s.needsRegeneration).length,
  };
}

export { QUALITY_DIMENSIONS, DEFAULT_THRESHOLD, REVIEW_THRESHOLD, REGEN_THRESHOLD };
