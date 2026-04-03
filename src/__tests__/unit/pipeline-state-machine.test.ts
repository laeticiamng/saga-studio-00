import { describe, it, expect } from "vitest";
import {
  canTransition,
  transition,
  getResumePoint,
  isTerminal,
  isActive,
  fromLegacy,
  toLegacy,
  ERROR_CODES,
} from "@/lib/pipeline-state-machine";

describe("Pipeline State Machine — P0.4", () => {
  it("allows valid transitions", () => {
    expect(canTransition("draft", "validating_inputs")).toBe(true);
    expect(canTransition("draft", "analyzing_audio")).toBe(true);
    expect(canTransition("analyzing_audio", "planning_storyboard")).toBe(true);
    expect(canTransition("generating_shots", "quality_review")).toBe(true);
    expect(canTransition("rendering", "completed")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransition("draft", "completed")).toBe(false);
    expect(canTransition("completed", "draft")).toBe(false);
    expect(canTransition("failed_terminal", "draft")).toBe(false);
    expect(canTransition("generating_shots", "draft")).toBe(false);
  });

  it("transition() returns error details for invalid transitions", () => {
    const result = transition("draft", "completed");
    expect(result.allowed).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.INVALID_TRANSITION);
    expect(result.errorMessage).toContain("Transition non autorisée");
  });

  it("transition() returns success for valid transitions", () => {
    const result = transition("draft", "analyzing_audio");
    expect(result.allowed).toBe(true);
    expect(result.from).toBe("draft");
    expect(result.to).toBe("analyzing_audio");
  });

  it("any active state can transition to failed_retryable", () => {
    const activeStates = ["validating_inputs", "analyzing_audio", "planning_storyboard", "resolving_provider", "generating_shots", "quality_review", "rendering"] as const;
    for (const s of activeStates) {
      expect(canTransition(s, "failed_retryable")).toBe(true);
    }
  });

  it("any active state can transition to cancelled", () => {
    expect(canTransition("generating_shots", "cancelled")).toBe(true);
    expect(canTransition("rendering", "cancelled")).toBe(true);
  });

  it("failed_retryable can resume from various points", () => {
    expect(canTransition("failed_retryable", "draft")).toBe(true);
    expect(canTransition("failed_retryable", "generating_shots")).toBe(true);
    expect(canTransition("failed_retryable", "rendering")).toBe(true);
  });

  it("failed_terminal has no transitions", () => {
    expect(isTerminal("failed_terminal")).toBe(true);
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
  });

  it("isActive identifies processing states", () => {
    expect(isActive("generating_shots")).toBe(true);
    expect(isActive("rendering")).toBe(true);
    expect(isActive("draft")).toBe(false);
    expect(isActive("completed")).toBe(false);
  });

  it("getResumePoint returns correct checkpoints", () => {
    expect(getResumePoint("rendering")).toBe("generating_shots");
    expect(getResumePoint("generating_shots")).toBe("resolving_provider");
    expect(getResumePoint("analyzing_audio")).toBe("draft");
  });

  it("legacy conversion works correctly", () => {
    expect(fromLegacy("analyzing")).toBe("analyzing_audio");
    expect(fromLegacy("generating")).toBe("generating_shots");
    expect(fromLegacy("stitching")).toBe("rendering");
    expect(fromLegacy("unknown")).toBe("draft");
  });

  it("toLegacy maps back correctly", () => {
    expect(toLegacy("analyzing_audio")).toBe("analyzing");
    expect(toLegacy("generating_shots")).toBe("generating");
    expect(toLegacy("rendering")).toBe("stitching");
    expect(toLegacy("failed_retryable")).toBe("failed");
  });
});
