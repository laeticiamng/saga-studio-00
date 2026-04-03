/**
 * Music Structure — P1.4
 * Enhanced music analysis utilities for native beat-sync clip generation.
 */

export interface MusicSection {
  label: string; // intro, verse, chorus, bridge, drop, outro
  startSec: number;
  endSec: number;
  energy: number; // 0-1
  bpm: number;
  isHighImpact: boolean;
}

export interface BeatGrid {
  bpm: number;
  downbeats: number[]; // timestamps in seconds
  beats: number[];
}

export interface CutPlan {
  shotIdx: number;
  startSec: number;
  endSec: number;
  section: string;
  energy: number;
  suggestedShotType: string;
  alignedToBeat: boolean;
}

export type ClipMode = "live" | "performance" | "narrative" | "hybrid";

/**
 * Map energy levels to shot types based on clip mode.
 */
function suggestShotType(energy: number, section: string, mode: ClipMode): string {
  if (mode === "live" || mode === "performance") {
    if (energy > 0.8) return "wide_dynamic";
    if (energy > 0.5) return "medium_performance";
    return "close_up_intimate";
  }

  if (mode === "narrative") {
    if (section === "chorus" || section === "drop") return "dramatic_reveal";
    if (section === "verse") return "narrative_scene";
    if (section === "bridge") return "transition_montage";
    return "establishing_shot";
  }

  // hybrid
  if (energy > 0.7) return "performance_wide";
  if (section === "verse") return "narrative_close";
  if (section === "chorus") return "dynamic_mixed";
  return "atmospheric";
}

/**
 * Generate a beat-aligned cut plan from music sections.
 */
export function generateCutPlan(
  sections: MusicSection[],
  beatGrid: BeatGrid,
  mode: ClipMode,
  targetShotCount?: number
): CutPlan[] {
  if (sections.length === 0) return [];

  const cuts: CutPlan[] = [];
  let shotIdx = 0;

  for (const section of sections) {
    const sectionDuration = section.endSec - section.startSec;
    // Higher energy = more frequent cuts
    const avgShotDuration = section.energy > 0.7 ? 3 : section.energy > 0.4 ? 5 : 8;
    const shotsInSection = Math.max(1, Math.round(sectionDuration / avgShotDuration));

    for (let i = 0; i < shotsInSection; i++) {
      const rawStart = section.startSec + (i * sectionDuration) / shotsInSection;
      const rawEnd = section.startSec + ((i + 1) * sectionDuration) / shotsInSection;

      // Snap to nearest beat
      const snappedStart = snapToBeat(rawStart, beatGrid.beats);
      const snappedEnd = i === shotsInSection - 1 ? rawEnd : snapToBeat(rawEnd, beatGrid.beats);

      cuts.push({
        shotIdx,
        startSec: snappedStart,
        endSec: snappedEnd,
        section: section.label,
        energy: section.energy,
        suggestedShotType: suggestShotType(section.energy, section.label, mode),
        alignedToBeat: Math.abs(snappedStart - rawStart) < 0.1,
      });
      shotIdx++;
    }
  }

  // Trim if target count specified
  if (targetShotCount && cuts.length > targetShotCount) {
    return cuts.slice(0, targetShotCount);
  }

  return cuts;
}

/**
 * Find the nearest beat timestamp.
 */
function snapToBeat(timestamp: number, beats: number[]): number {
  if (beats.length === 0) return timestamp;
  let closest = beats[0];
  let minDist = Math.abs(timestamp - beats[0]);
  for (const b of beats) {
    const dist = Math.abs(timestamp - b);
    if (dist < minDist) {
      minDist = dist;
      closest = b;
    }
  }
  return closest;
}

/**
 * Extract the highest-impact sections for teaser generation.
 */
export function getHighImpactSections(sections: MusicSection[], maxDurationSec = 15): MusicSection[] {
  const sorted = [...sections]
    .filter(s => s.isHighImpact || s.energy > 0.7)
    .sort((a, b) => b.energy - a.energy);

  const selected: MusicSection[] = [];
  let totalDuration = 0;

  for (const s of sorted) {
    const dur = s.endSec - s.startSec;
    if (totalDuration + dur <= maxDurationSec) {
      selected.push(s);
      totalDuration += dur;
    }
  }

  return selected.sort((a, b) => a.startSec - b.startSec);
}

/**
 * Parse raw audio analysis JSON into typed structures.
 */
export function parseSections(sectionsJson: unknown[]): MusicSection[] {
  if (!Array.isArray(sectionsJson)) return [];
  return sectionsJson.map((s: any) => ({
    label: s.label || s.section || "unknown",
    startSec: s.start_sec ?? s.start ?? 0,
    endSec: s.end_sec ?? s.end ?? 0,
    energy: s.energy ?? 0.5,
    bpm: s.bpm ?? 120,
    isHighImpact: s.is_high_impact ?? (s.energy > 0.7),
  }));
}
