import { describe, it, expect } from "vitest";

/**
 * Unit tests for quality gates logic.
 */

describe("Continuity Gate", () => {
  type Verdict = "pass" | "flag" | "block";

  function evaluateContinuity(conflicts: Array<{ severity: string }>): { verdict: Verdict; canProceed: boolean } {
    const critical = conflicts.filter(c => c.severity === "critical");
    const errors = conflicts.filter(c => c.severity === "error");

    if (critical.length > 0) return { verdict: "block", canProceed: false };
    if (errors.length > 0) return { verdict: "flag", canProceed: false };
    if (conflicts.length > 0) return { verdict: "flag", canProceed: true };
    return { verdict: "pass", canProceed: true };
  }

  it("passes when no conflicts", () => {
    expect(evaluateContinuity([]).verdict).toBe("pass");
  });

  it("flags on warnings but allows proceed", () => {
    const result = evaluateContinuity([{ severity: "warning" }]);
    expect(result.verdict).toBe("flag");
    expect(result.canProceed).toBe(true);
  });

  it("blocks on critical conflicts", () => {
    const result = evaluateContinuity([{ severity: "critical" }]);
    expect(result.verdict).toBe("block");
    expect(result.canProceed).toBe(false);
  });

  it("flags on errors and blocks proceed", () => {
    const result = evaluateContinuity([{ severity: "error" }]);
    expect(result.verdict).toBe("flag");
    expect(result.canProceed).toBe(false);
  });
});

describe("Psychology Gate", () => {
  function evaluatePsychology(assessments: Array<{ isConsistent: boolean; severity: string }>): string {
    const blocked = assessments.some(a => !a.isConsistent && a.severity === "critical");
    const flagged = assessments.some(a => !a.isConsistent);
    if (blocked) return "block";
    if (flagged) return "flag";
    return "pass";
  }

  it("passes when all consistent", () => {
    expect(evaluatePsychology([
      { isConsistent: true, severity: "info" },
      { isConsistent: true, severity: "info" },
    ])).toBe("pass");
  });

  it("flags on inconsistency", () => {
    expect(evaluatePsychology([
      { isConsistent: true, severity: "info" },
      { isConsistent: false, severity: "warning" },
    ])).toBe("flag");
  });

  it("blocks on critical inconsistency", () => {
    expect(evaluatePsychology([
      { isConsistent: false, severity: "critical" },
    ])).toBe("block");
  });
});

describe("Legal/Ethics Gate", () => {
  function evaluateLegal(flags: Array<{ category: string; severity: string }>): { verdict: string; canExport: boolean } {
    const blocking = ["defamation", "copyright_violation", "hate_speech"];
    const hasBlocking = flags.some(f => blocking.includes(f.category) || f.severity === "critical");
    if (hasBlocking) return { verdict: "block", canExport: false };
    if (flags.length > 0) return { verdict: "flag", canExport: true };
    return { verdict: "pass", canExport: true };
  }

  it("passes with no flags", () => {
    expect(evaluateLegal([]).verdict).toBe("pass");
  });

  it("blocks on defamation", () => {
    expect(evaluateLegal([{ category: "defamation", severity: "error" }]).canExport).toBe(false);
  });

  it("blocks on copyright violation", () => {
    expect(evaluateLegal([{ category: "copyright_violation", severity: "warning" }]).canExport).toBe(false);
  });

  it("allows export on minor flags", () => {
    expect(evaluateLegal([{ category: "sensitivity", severity: "warning" }]).canExport).toBe(true);
  });
});

describe("Redaction/Compliance Gate", () => {
  function canExport(brandFlags: Array<{ severity: string; resolved: boolean }>, legalVerdict: string, psychVerdict: string): boolean {
    const unresolvedCritical = brandFlags.some(f => f.severity === "critical" && !f.resolved);
    if (unresolvedCritical) return false;
    if (legalVerdict === "block") return false;
    if (psychVerdict === "block") return false;
    return true;
  }

  it("blocks export with unresolved critical brand flag", () => {
    expect(canExport([{ severity: "critical", resolved: false }], "pass", "pass")).toBe(false);
  });

  it("allows export with resolved critical flag", () => {
    expect(canExport([{ severity: "critical", resolved: true }], "pass", "pass")).toBe(true);
  });

  it("blocks export when legal blocks", () => {
    expect(canExport([], "block", "pass")).toBe(false);
  });

  it("blocks export when psychology blocks", () => {
    expect(canExport([], "pass", "block")).toBe(false);
  });

  it("allows export when all clear", () => {
    expect(canExport([], "pass", "pass")).toBe(true);
  });
});

describe("Final QC Gate", () => {
  function computeQCVerdict(checks: Array<{ status: string }>): { verdict: string; canDeliver: boolean } {
    const failed = checks.filter(c => c.status === "fail");
    const warnings = checks.filter(c => c.status === "warn");
    if (failed.length > 0) return { verdict: "fail", canDeliver: false };
    if (warnings.length > 0) return { verdict: "conditional_pass", canDeliver: true };
    return { verdict: "pass", canDeliver: true };
  }

  it("passes with all green", () => {
    const result = computeQCVerdict([
      { status: "pass" }, { status: "pass" }, { status: "pass" },
    ]);
    expect(result.verdict).toBe("pass");
    expect(result.canDeliver).toBe(true);
  });

  it("conditional pass with warnings", () => {
    const result = computeQCVerdict([
      { status: "pass" }, { status: "warn" }, { status: "pass" },
    ]);
    expect(result.verdict).toBe("conditional_pass");
    expect(result.canDeliver).toBe(true);
  });

  it("fails with any failure", () => {
    const result = computeQCVerdict([
      { status: "pass" }, { status: "fail" }, { status: "pass" },
    ]);
    expect(result.verdict).toBe("fail");
    expect(result.canDeliver).toBe(false);
  });
});

describe("Delivery Gate", () => {
  function canDeliver(qcVerdict: string, complianceVerdict: string, continuityVerdict: string): boolean {
    if (qcVerdict === "fail") return false;
    if (complianceVerdict === "fail") return false;
    if (continuityVerdict === "block") return false;
    return true;
  }

  it("blocks delivery when QC fails", () => {
    expect(canDeliver("fail", "pass", "pass")).toBe(false);
  });

  it("blocks delivery when compliance fails", () => {
    expect(canDeliver("pass", "fail", "pass")).toBe(false);
  });

  it("blocks delivery when continuity blocks", () => {
    expect(canDeliver("pass", "pass", "block")).toBe(false);
  });

  it("allows delivery when all pass", () => {
    expect(canDeliver("pass", "pass", "pass")).toBe(true);
  });

  it("allows delivery with conditional QC pass", () => {
    expect(canDeliver("conditional_pass", "pass", "pass")).toBe(true);
  });
});
