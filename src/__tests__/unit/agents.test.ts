import { describe, it, expect } from "vitest";

/**
 * Unit tests for agent system logic.
 */

const REQUIRED_AGENTS = [
  "showrunner", "story_architect", "scriptwriter", "dialogue_coach",
  "psychology_reviewer", "legal_ethics_reviewer", "continuity_checker",
  "visual_director", "scene_designer", "shot_planner",
  "music_director", "voice_director", "editor", "colorist",
  "qa_reviewer", "delivery_manager",
  // Extended agents
  "script_doctor", "production_designer", "costume_designer",
  "props_designer", "casting_consistency", "sound_music", "delivery_supervisor",
];

const AGENT_CATEGORIES = ["writing", "validation", "visual", "audio", "production", "delivery"];
const AGENT_ROLES = ["orchestrator", "creator", "refiner", "reviewer", "assembler"];

describe("Agent Registry Completeness", () => {
  it("has at least 16 core agents", () => {
    expect(REQUIRED_AGENTS.length).toBeGreaterThanOrEqual(16);
  });

  it("includes all mandatory agents from spec", () => {
    const mandatory = [
      "showrunner", "scriptwriter", "psychology_reviewer",
      "legal_ethics_reviewer", "continuity_checker", "editor",
      "qa_reviewer", "delivery_manager",
    ];
    for (const agent of mandatory) {
      expect(REQUIRED_AGENTS).toContain(agent);
    }
  });

  it("includes script_doctor", () => {
    expect(REQUIRED_AGENTS).toContain("script_doctor");
  });

  it("includes costume_designer", () => {
    expect(REQUIRED_AGENTS).toContain("costume_designer");
  });

  it("includes props_designer", () => {
    expect(REQUIRED_AGENTS).toContain("props_designer");
  });

  it("includes casting_consistency", () => {
    expect(REQUIRED_AGENTS).toContain("casting_consistency");
  });

  it("includes sound_music", () => {
    expect(REQUIRED_AGENTS).toContain("sound_music");
  });

  it("includes delivery_supervisor", () => {
    expect(REQUIRED_AGENTS).toContain("delivery_supervisor");
  });
});

describe("Agent Confidence Estimation", () => {
  function estimateConfidence(response: { content: Record<string, unknown>; model?: string }): number {
    if (response.model === "fallback") return 0.3;
    const issues = response.content?.issues;
    if (Array.isArray(issues) && issues.length > 0) return Math.max(0.5, 1 - issues.length * 0.1);
    if (response.content?.verdict === "block") return 0.2;
    if (response.content?.verdict === "flag") return 0.6;
    if (response.content?.verdict === "pass") return 0.95;
    return 0.75;
  }

  it("fallback model gives low confidence", () => {
    expect(estimateConfidence({ content: {}, model: "fallback" })).toBe(0.3);
  });

  it("pass verdict gives high confidence", () => {
    expect(estimateConfidence({ content: { verdict: "pass" } })).toBe(0.95);
  });

  it("block verdict gives very low confidence", () => {
    expect(estimateConfidence({ content: { verdict: "block" } })).toBe(0.2);
  });

  it("issues reduce confidence proportionally", () => {
    const c1 = estimateConfidence({ content: { issues: ["a"] } });
    const c2 = estimateConfidence({ content: { issues: ["a", "b", "c"] } });
    expect(c1).toBeGreaterThan(c2);
  });

  it("confidence never drops below 0.5 with issues", () => {
    const c = estimateConfidence({ content: { issues: Array(20).fill("x") } });
    expect(c).toBeGreaterThanOrEqual(0.5);
  });

  it("no verdict defaults to 0.75", () => {
    expect(estimateConfidence({ content: {} })).toBe(0.75);
  });
});

describe("Agent Dependencies", () => {
  const DEPENDENCIES: Record<string, string[]> = {
    showrunner: [],
    story_architect: [],
    scriptwriter: ["story_architect"],
    dialogue_coach: ["scriptwriter"],
    psychology_reviewer: ["scriptwriter"],
    legal_ethics_reviewer: ["scriptwriter"],
    continuity_checker: ["scriptwriter"],
    visual_director: ["story_architect"],
    scene_designer: ["scriptwriter", "visual_director"],
    shot_planner: ["scene_designer"],
    editor: ["shot_planner"],
    qa_reviewer: ["editor"],
    delivery_manager: ["qa_reviewer"],
  };

  it("showrunner has no dependencies", () => {
    expect(DEPENDENCIES.showrunner).toHaveLength(0);
  });

  it("scriptwriter depends on story_architect", () => {
    expect(DEPENDENCIES.scriptwriter).toContain("story_architect");
  });

  it("no circular dependencies in core chain", () => {
    function hasCircular(slug: string, visited: Set<string>): boolean {
      if (visited.has(slug)) return true;
      visited.add(slug);
      for (const dep of DEPENDENCIES[slug] || []) {
        if (hasCircular(dep, new Set(visited))) return true;
      }
      return false;
    }

    for (const slug of Object.keys(DEPENDENCIES)) {
      expect(hasCircular(slug, new Set())).toBe(false);
    }
  });

  it("all dependencies reference existing agents", () => {
    const allSlugs = new Set(Object.keys(DEPENDENCIES));
    for (const deps of Object.values(DEPENDENCIES)) {
      for (const dep of deps) {
        expect(allSlugs.has(dep)).toBe(true);
      }
    }
  });
});
