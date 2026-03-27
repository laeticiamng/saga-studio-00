import { describe, it, expect } from "vitest";

/**
 * Unit tests for document ingestion and autofill logic.
 */

describe("Document Classification", () => {
  function classifyDocument(filename: string, mimeType: string): string {
    if (mimeType === "application/pdf") return "pdf";
    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
    if (mimeType === "text/markdown" || filename.endsWith(".md")) return "markdown";
    if (mimeType === "text/plain" || filename.endsWith(".txt")) return "text";
    if (mimeType === "text/rtf" || filename.endsWith(".rtf")) return "rtf";
    return "unknown";
  }

  it("classifies PDF files", () => {
    expect(classifyDocument("bible.pdf", "application/pdf")).toBe("pdf");
  });

  it("classifies DOCX files", () => {
    expect(classifyDocument("script.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("docx");
  });

  it("classifies Markdown files", () => {
    expect(classifyDocument("notes.md", "text/markdown")).toBe("markdown");
  });

  it("classifies TXT files", () => {
    expect(classifyDocument("ideas.txt", "text/plain")).toBe("text");
  });

  it("returns unknown for unsupported types", () => {
    expect(classifyDocument("image.png", "image/png")).toBe("unknown");
  });
});

describe("Entity Extraction Confidence", () => {
  function computeMappingConfidence(
    extractionConfidence: number,
    semanticConfidence: number,
    hasAmbiguity: boolean
  ): number {
    let score = (extractionConfidence * 0.5) + (semanticConfidence * 0.5);
    if (hasAmbiguity) score *= 0.7;
    return Math.round(score * 100) / 100;
  }

  it("high extraction + high semantic = high mapping", () => {
    expect(computeMappingConfidence(0.95, 0.90, false)).toBeGreaterThanOrEqual(0.9);
  });

  it("ambiguity reduces confidence", () => {
    const withoutAmbiguity = computeMappingConfidence(0.90, 0.90, false);
    const withAmbiguity = computeMappingConfidence(0.90, 0.90, true);
    expect(withAmbiguity).toBeLessThan(withoutAmbiguity);
  });

  it("low extraction reduces overall confidence", () => {
    expect(computeMappingConfidence(0.3, 0.9, false)).toBeLessThan(0.7);
  });
});

describe("Autofill Threshold Rules", () => {
  type AutofillAction = "auto_fill" | "propose" | "suggest_only";

  function getAutofillAction(confidence: number): AutofillAction {
    if (confidence >= 0.85) return "auto_fill";
    if (confidence >= 0.60) return "propose";
    return "suggest_only";
  }

  it("auto-fills at high confidence", () => {
    expect(getAutofillAction(0.95)).toBe("auto_fill");
    expect(getAutofillAction(0.85)).toBe("auto_fill");
  });

  it("proposes at medium confidence", () => {
    expect(getAutofillAction(0.75)).toBe("propose");
    expect(getAutofillAction(0.60)).toBe("propose");
  });

  it("suggests only at low confidence", () => {
    expect(getAutofillAction(0.50)).toBe("suggest_only");
    expect(getAutofillAction(0.10)).toBe("suggest_only");
  });
});

describe("Source Priority / Override Rules", () => {
  type Source = "manual_edit" | "validated_document" | "raw_document" | "ai_suggestion";

  const PRIORITY: Record<Source, number> = {
    manual_edit: 4,
    validated_document: 3,
    raw_document: 2,
    ai_suggestion: 1,
  };

  function shouldOverride(currentSource: Source, newSource: Source): boolean {
    return PRIORITY[newSource] > PRIORITY[currentSource];
  }

  it("manual edit is never overridden by document", () => {
    expect(shouldOverride("manual_edit", "validated_document")).toBe(false);
    expect(shouldOverride("manual_edit", "raw_document")).toBe(false);
    expect(shouldOverride("manual_edit", "ai_suggestion")).toBe(false);
  });

  it("validated document overrides raw document", () => {
    expect(shouldOverride("raw_document", "validated_document")).toBe(true);
  });

  it("ai suggestion does not override raw document", () => {
    expect(shouldOverride("raw_document", "ai_suggestion")).toBe(false);
  });

  it("manual edit overrides everything", () => {
    expect(shouldOverride("ai_suggestion", "manual_edit")).toBe(true);
    expect(shouldOverride("raw_document", "manual_edit")).toBe(true);
    expect(shouldOverride("validated_document", "manual_edit")).toBe(true);
  });
});

describe("Document Versioning", () => {
  function detectChanges(
    oldEntities: Array<{ key: string; value: string }>,
    newEntities: Array<{ key: string; value: string }>
  ): { added: string[]; changed: string[]; removed: string[] } {
    const oldMap = new Map(oldEntities.map(e => [e.key, e.value]));
    const newMap = new Map(newEntities.map(e => [e.key, e.value]));

    const added = [...newMap.keys()].filter(k => !oldMap.has(k));
    const removed = [...oldMap.keys()].filter(k => !newMap.has(k));
    const changed = [...newMap.keys()].filter(k => oldMap.has(k) && oldMap.get(k) !== newMap.get(k));

    return { added, changed, removed };
  }

  it("detects added entities", () => {
    const old = [{ key: "title", value: "Saga" }];
    const next = [{ key: "title", value: "Saga" }, { key: "genre", value: "Sci-Fi" }];
    const diff = detectChanges(old, next);
    expect(diff.added).toContain("genre");
    expect(diff.changed).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });

  it("detects changed entities", () => {
    const old = [{ key: "title", value: "Saga" }];
    const next = [{ key: "title", value: "Saga 2.0" }];
    const diff = detectChanges(old, next);
    expect(diff.changed).toContain("title");
  });

  it("detects removed entities", () => {
    const old = [{ key: "title", value: "Saga" }, { key: "genre", value: "Sci-Fi" }];
    const next = [{ key: "title", value: "Saga" }];
    const diff = detectChanges(old, next);
    expect(diff.removed).toContain("genre");
  });

  it("reports no changes when identical", () => {
    const entities = [{ key: "title", value: "Saga" }];
    const diff = detectChanges(entities, entities);
    expect(diff.added).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });
});
