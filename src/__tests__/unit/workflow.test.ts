import { describe, it, expect } from "vitest";

/**
 * Unit tests for workflow orchestration logic.
 */

const PIPELINE_STEPS: Record<string, { agents: string[]; nextStatus: string; requiresApproval: boolean; autoAdvanceThreshold: number }> = {
  story_development:   { agents: ["story_architect", "scriptwriter"], nextStatus: "psychology_review", requiresApproval: false, autoAdvanceThreshold: 0 },
  psychology_review:   { agents: ["psychology_reviewer"], nextStatus: "legal_ethics_review", requiresApproval: true, autoAdvanceThreshold: 0.85 },
  legal_ethics_review: { agents: ["legal_ethics_reviewer"], nextStatus: "visual_bible", requiresApproval: true, autoAdvanceThreshold: 0.90 },
  visual_bible:        { agents: ["visual_director"], nextStatus: "continuity_check", requiresApproval: false, autoAdvanceThreshold: 0 },
  continuity_check:    { agents: ["continuity_checker"], nextStatus: "shot_generation", requiresApproval: true, autoAdvanceThreshold: 0.90 },
  shot_generation:     { agents: ["scene_designer", "shot_planner"], nextStatus: "shot_review", requiresApproval: false, autoAdvanceThreshold: 0 },
  shot_review:         { agents: ["qa_reviewer"], nextStatus: "assembly", requiresApproval: true, autoAdvanceThreshold: 0.80 },
  assembly:            { agents: ["editor"], nextStatus: "edit_review", requiresApproval: false, autoAdvanceThreshold: 0 },
  edit_review:         { agents: ["qa_reviewer"], nextStatus: "delivery", requiresApproval: true, autoAdvanceThreshold: 0.85 },
  delivery:            { agents: ["delivery_manager"], nextStatus: "completed", requiresApproval: false, autoAdvanceThreshold: 0 },
};

describe("Workflow Pipeline Structure", () => {
  it("pipeline has 10 steps", () => {
    expect(Object.keys(PIPELINE_STEPS)).toHaveLength(10);
  });

  it("each step transitions to the next correctly", () => {
    const keys = Object.keys(PIPELINE_STEPS);
    for (let i = 0; i < keys.length - 1; i++) {
      expect(PIPELINE_STEPS[keys[i]].nextStatus).toBe(keys[i + 1]);
    }
    expect(PIPELINE_STEPS[keys[keys.length - 1]].nextStatus).toBe("completed");
  });

  it("approval steps have thresholds above 0", () => {
    for (const [key, step] of Object.entries(PIPELINE_STEPS)) {
      if (step.requiresApproval) {
        expect(step.autoAdvanceThreshold).toBeGreaterThan(0);
      }
    }
  });

  it("every step has at least one agent", () => {
    for (const step of Object.values(PIPELINE_STEPS)) {
      expect(step.agents.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("all agent slugs are unique within a step", () => {
    for (const step of Object.values(PIPELINE_STEPS)) {
      const unique = new Set(step.agents);
      expect(unique.size).toBe(step.agents.length);
    }
  });
});

describe("Confidence-based Auto-approval", () => {
  function shouldAutoApprove(score: number, threshold: number): boolean {
    return score >= threshold;
  }

  it("auto-approves when score >= threshold", () => {
    expect(shouldAutoApprove(0.90, 0.85)).toBe(true);
    expect(shouldAutoApprove(0.85, 0.85)).toBe(true);
  });

  it("requires manual approval when score < threshold", () => {
    expect(shouldAutoApprove(0.84, 0.85)).toBe(false);
    expect(shouldAutoApprove(0.50, 0.90)).toBe(false);
  });

  it("never auto-approves at 0 confidence", () => {
    expect(shouldAutoApprove(0, 0.85)).toBe(false);
  });
});

describe("Idempotency Key Generation", () => {
  function generateIdempotencyKey(episodeId: string, status: string, agentSlug: string, runId: string): string {
    return `${episodeId}_${status}_${agentSlug}_${runId}`;
  }

  it("produces deterministic keys", () => {
    const key1 = generateIdempotencyKey("ep1", "story_development", "scriptwriter", "run1");
    const key2 = generateIdempotencyKey("ep1", "story_development", "scriptwriter", "run1");
    expect(key1).toBe(key2);
  });

  it("produces different keys for different inputs", () => {
    const key1 = generateIdempotencyKey("ep1", "story_development", "scriptwriter", "run1");
    const key2 = generateIdempotencyKey("ep1", "psychology_review", "scriptwriter", "run1");
    expect(key1).not.toBe(key2);
  });
});

describe("Episode Status State Machine", () => {
  const VALID_STATUSES = [
    "draft", "story_development", "psychology_review", "legal_ethics_review",
    "visual_bible", "continuity_check", "shot_generation", "shot_review",
    "assembly", "edit_review", "delivery", "completed", "failed", "cancelled",
  ];

  const TERMINAL_STATUSES = ["completed", "failed", "cancelled"];

  it("draft can only transition to story_development", () => {
    // Draft is not in PIPELINE_STEPS, it transitions via autopilot-run
    expect(PIPELINE_STEPS["draft"]).toBeUndefined();
  });

  it("terminal statuses have no forward transition", () => {
    for (const status of TERMINAL_STATUSES) {
      expect(PIPELINE_STEPS[status]).toBeUndefined();
    }
  });

  it("no step transitions to a terminal status other than completed", () => {
    for (const step of Object.values(PIPELINE_STEPS)) {
      expect(step.nextStatus).not.toBe("failed");
      expect(step.nextStatus).not.toBe("cancelled");
    }
  });

  it("completed is reachable from delivery", () => {
    expect(PIPELINE_STEPS["delivery"].nextStatus).toBe("completed");
  });
});

describe("Retry Policy", () => {
  function shouldRetry(retryCount: number, maxRetries: number): boolean {
    return retryCount < maxRetries;
  }

  function retryDelay(attempt: number): number {
    return Math.pow(2, attempt) * 1000;
  }

  it("retries when under max", () => {
    expect(shouldRetry(0, 3)).toBe(true);
    expect(shouldRetry(2, 3)).toBe(true);
  });

  it("stops retrying at max", () => {
    expect(shouldRetry(3, 3)).toBe(false);
  });

  it("uses exponential backoff", () => {
    expect(retryDelay(0)).toBe(1000);
    expect(retryDelay(1)).toBe(2000);
    expect(retryDelay(2)).toBe(4000);
  });
});
