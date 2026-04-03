import { describe, it, expect } from "vitest";
import { scoreShotQuality, scoreProjectQuality, DEFAULT_THRESHOLD } from "@/lib/quality-scoring";
import { validateContinuity } from "@/lib/continuity-validator";
import { generateCutPlan, getHighImpactSections, parseSections } from "@/lib/music-structure";

describe("Quality Scoring — P1.2", () => {
  it("scores a shot with default dimensions", () => {
    const score = scoreShotQuality("shot-1", 0, {});
    expect(score.globalScore).toBeGreaterThan(0);
    expect(score.globalScore).toBeLessThanOrEqual(1);
    expect(score.dimensions).toHaveLength(8);
  });

  it("marks low-scoring shots for review", () => {
    const score = scoreShotQuality("shot-1", 0, {
      face_consistency: 0.2,
      outfit_consistency: 0.3,
      decor_consistency: 0.2,
      color_palette: 0.3,
      style_stability: 0.2,
      sharpness: 0.3,
      beat_match: 0.2,
      section_relevance: 0.3,
    });
    expect(score.needsReview).toBe(true);
  });

  it("marks very low shots for regeneration", () => {
    const score = scoreShotQuality("shot-1", 0, {
      face_consistency: 0.1,
      outfit_consistency: 0.1,
      decor_consistency: 0.1,
      color_palette: 0.1,
      style_stability: 0.1,
      sharpness: 0.1,
      beat_match: 0.1,
      section_relevance: 0.1,
    });
    expect(score.needsRegeneration).toBe(true);
  });

  it("project score blocks if below threshold", () => {
    const shots = [
      scoreShotQuality("s1", 0, { face_consistency: 0.3, style_stability: 0.3 }),
      scoreShotQuality("s2", 1, { face_consistency: 0.3, style_stability: 0.3 }),
    ];
    const project = scoreProjectQuality("proj-1", shots, 0.9);
    expect(project.passesThreshold).toBe(false);
  });

  it("project score passes with good shots", () => {
    const shots = [
      scoreShotQuality("s1", 0, {}), // defaults to 0.7 each
      scoreShotQuality("s2", 1, {}),
    ];
    const project = scoreProjectQuality("proj-1", shots);
    expect(project.passesThreshold).toBe(true);
  });
});

describe("Continuity Validator — P1.3", () => {
  it("detects continuity errors for low scores", () => {
    const report = validateContinuity("proj-1", [
      { shotA: 0, shotB: 1, scores: { face: 0.1, clothing: 0.2 } },
    ]);
    expect(report.errorCount).toBeGreaterThan(0);
    expect(report.retrySuggestions.length).toBeGreaterThan(0);
  });

  it("passes with high continuity scores", () => {
    const report = validateContinuity("proj-1", [
      { shotA: 0, shotB: 1, scores: { face: 0.9, clothing: 0.9, lighting: 0.9, palette: 0.9, decor: 0.9, props: 0.9, framing: 0.85, hair: 0.9 } },
    ]);
    expect(report.errorCount).toBe(0);
    expect(report.warningCount).toBe(0);
  });

  it("generates retry suggestions for errors", () => {
    const report = validateContinuity("proj-1", [
      { shotA: 2, shotB: 3, scores: { face: 0.1 } },
    ]);
    const suggestion = report.retrySuggestions.find(r => r.shotIdx === 3);
    expect(suggestion).toBeDefined();
  });
});

describe("Music Structure — P1.4", () => {
  const sections = [
    { label: "intro", startSec: 0, endSec: 15, energy: 0.3, bpm: 120, isHighImpact: false },
    { label: "verse", startSec: 15, endSec: 45, energy: 0.5, bpm: 120, isHighImpact: false },
    { label: "chorus", startSec: 45, endSec: 75, energy: 0.9, bpm: 120, isHighImpact: true },
    { label: "outro", startSec: 75, endSec: 90, energy: 0.2, bpm: 120, isHighImpact: false },
  ];

  const beatGrid = {
    bpm: 120,
    downbeats: [0, 2, 4, 6, 8],
    beats: Array.from({ length: 180 }, (_, i) => i * 0.5),
  };

  it("generates a cut plan aligned to beats", () => {
    const plan = generateCutPlan(sections, beatGrid, "performance");
    expect(plan.length).toBeGreaterThan(0);
    expect(plan[0].section).toBe("intro");
    expect(plan[0].alignedToBeat).toBe(true);
  });

  it("higher energy sections produce more cuts", () => {
    const plan = generateCutPlan(sections, beatGrid, "performance");
    const introCuts = plan.filter(c => c.section === "intro").length;
    const chorusCuts = plan.filter(c => c.section === "chorus").length;
    expect(chorusCuts).toBeGreaterThanOrEqual(introCuts);
  });

  it("getHighImpactSections returns chorus-like sections", () => {
    const impact = getHighImpactSections(sections);
    expect(impact.some(s => s.label === "chorus")).toBe(true);
  });

  it("parseSections handles raw JSON", () => {
    const raw = [{ label: "intro", start_sec: 0, end_sec: 10, energy: 0.5 }];
    const parsed = parseSections(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].startSec).toBe(0);
    expect(parsed[0].endSec).toBe(10);
  });

  it("generateCutPlan respects target shot count", () => {
    const plan = generateCutPlan(sections, beatGrid, "narrative", 5);
    expect(plan.length).toBeLessThanOrEqual(5);
  });
});
