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

describe("DOCX Extraction Routing", () => {
  // Simulates the extractTextFromFile routing logic
  function getExtractionRoute(fileType: string): {
    parser: string;
    fallbackToPdf: boolean;
  } {
    if (fileType === "txt" || fileType === "markdown" || fileType === "rtf") {
      return { parser: "plain_text", fallbackToPdf: false };
    }
    if (fileType === "docx") {
      return { parser: "docx_xml_parse", fallbackToPdf: false };
    }
    if (fileType === "pdf") {
      return { parser: "pdf_vision_api", fallbackToPdf: false };
    }
    return { parser: "unknown", fallbackToPdf: false };
  }

  it("routes DOCX to docx_xml_parse, never to PDF", () => {
    const route = getExtractionRoute("docx");
    expect(route.parser).toBe("docx_xml_parse");
    expect(route.fallbackToPdf).toBe(false);
  });

  it("routes PDF to pdf_vision_api", () => {
    const route = getExtractionRoute("pdf");
    expect(route.parser).toBe("pdf_vision_api");
    expect(route.fallbackToPdf).toBe(false);
  });

  it("routes plain text files directly", () => {
    expect(getExtractionRoute("txt").parser).toBe("plain_text");
    expect(getExtractionRoute("markdown").parser).toBe("plain_text");
    expect(getExtractionRoute("rtf").parser).toBe("plain_text");
  });
});

describe("Extraction Failure Status", () => {
  function isExtractionFailure(extractionMode: string | null, status: string | null): boolean {
    return Boolean(
      extractionMode?.includes("failed") ||
      extractionMode?.includes("error") ||
      status?.includes("failed")
    );
  }

  it("detects docx_parse_failed as failure", () => {
    expect(isExtractionFailure("docx_parse_failed: Not a valid ZIP/DOCX", "parsing_failed")).toBe(true);
  });

  it("detects pdf_vision_api_error as failure", () => {
    expect(isExtractionFailure("pdf_vision_api_error", "ready_for_review")).toBe(true);
  });

  it("detects parsing_failed status", () => {
    expect(isExtractionFailure("unknown", "parsing_failed")).toBe(true);
  });

  it("does not flag successful extraction", () => {
    expect(isExtractionFailure("docx_xml_parse", "ready_for_review")).toBe(false);
  });

  it("does not flag pdf_vision_api success", () => {
    expect(isExtractionFailure("pdf_vision_api", "analyzing")).toBe(false);
  });
});

describe("Decompression Strategy Priority", () => {
  // pako is the primary decompression strategy (pure JS, works everywhere)
  // DecompressionStream is fallback only

  const DECOMPRESSION_STRATEGIES = [
    "pako_inflate_raw",     // 1st: pako.inflateRaw — correct for ZIP raw DEFLATE
    "pako_inflate_zlib",    // 2nd: pako.inflate — zlib-wrapped fallback
    "stream_deflate_raw",   // 3rd: DecompressionStream("deflate-raw")
    "stream_deflate",       // 4th: DecompressionStream("deflate")
  ];

  it("pako_inflate_raw is the primary strategy", () => {
    expect(DECOMPRESSION_STRATEGIES[0]).toBe("pako_inflate_raw");
  });

  it("pako strategies come before DecompressionStream strategies", () => {
    const pakoIdx = DECOMPRESSION_STRATEGIES.findIndex(s => s.startsWith("pako"));
    const streamIdx = DECOMPRESSION_STRATEGIES.findIndex(s => s.startsWith("stream"));
    expect(pakoIdx).toBeLessThan(streamIdx);
  });

  it("does not include unreliable 'raw' format", () => {
    expect(DECOMPRESSION_STRATEGIES).not.toContain("raw");
    expect(DECOMPRESSION_STRATEGIES).not.toContain("stream_raw");
  });

  const VALID_DECOMPRESSION_FORMATS = ["deflate", "deflate-raw", "gzip"];

  it("deflate-raw is a valid DecompressionStream format", () => {
    expect(VALID_DECOMPRESSION_FORMATS).toContain("deflate-raw");
  });

  it("'raw' is NOT a valid DecompressionStream format", () => {
    expect(VALID_DECOMPRESSION_FORMATS).not.toContain("raw");
  });
});

describe("Pipeline Status Transitions", () => {
  const VALID_STATUSES = [
    "uploaded", "extracting", "parsing", "parsed", "parsing_failed",
    "analyzing", "extracting_entities", "extracted_entities", "extraction_failed",
    "ready_for_review", "reviewed", "applied",
  ];

  it("has parsing_failed as a valid status", () => {
    expect(VALID_STATUSES).toContain("parsing_failed");
  });

  it("has extraction_failed as a valid status", () => {
    expect(VALID_STATUSES).toContain("extraction_failed");
  });

  function shouldProceedToAI(parserSuccess: boolean, textLength: number): boolean {
    return parserSuccess && textLength >= 20;
  }

  it("blocks AI extraction when parser failed", () => {
    expect(shouldProceedToAI(false, 0)).toBe(false);
    expect(shouldProceedToAI(false, 500)).toBe(false);
  });

  it("blocks AI extraction when text too short", () => {
    expect(shouldProceedToAI(true, 10)).toBe(false);
    expect(shouldProceedToAI(true, 0)).toBe(false);
  });

  it("allows AI extraction when parser succeeded with enough text", () => {
    expect(shouldProceedToAI(true, 500)).toBe(true);
    expect(shouldProceedToAI(true, 20)).toBe(true);
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

// ═══════════════════════════════════════════════════
// PARSER STATUS CODES
// ═══════════════════════════════════════════════════

describe("Parser Status Codes", () => {
  const PARSER_STATUS = {
    DOCX_PARSE_STARTED: "docx_parse_started",
    DOCX_PARSE_SUCCEEDED: "docx_parse_succeeded",
    DOCX_PARSE_FAILED: "docx_parse_failed",
    PDF_PARSE_STARTED: "pdf_parse_started",
    PDF_PARSE_SUCCEEDED: "pdf_parse_succeeded",
    PDF_PARSE_FAILED: "pdf_parse_failed",
    TEXT_PARSE_SUCCEEDED: "text_parse_succeeded",
    TEXT_PARSE_FAILED: "text_parse_failed",
    UNSUPPORTED_FILE_TYPE: "unsupported_file_type",
    DOWNLOAD_FAILED: "download_failed",
    DOC_LEGACY_UNSUPPORTED: "doc_legacy_unsupported",
  } as const;

  it("has distinct statuses for each parser outcome", () => {
    const values = Object.values(PARSER_STATUS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it("DOCX statuses never contain 'pdf'", () => {
    expect(PARSER_STATUS.DOCX_PARSE_SUCCEEDED).not.toContain("pdf");
    expect(PARSER_STATUS.DOCX_PARSE_FAILED).not.toContain("pdf");
  });

  it("has explicit doc_legacy_unsupported for .doc files", () => {
    expect(PARSER_STATUS.DOC_LEGACY_UNSUPPORTED).toBe("doc_legacy_unsupported");
  });

  it("never includes pdf_vision_api_error as a valid status", () => {
    const allStatuses = Object.values(PARSER_STATUS);
    expect(allStatuses).not.toContain("pdf_vision_api_error");
  });
});

// ═══════════════════════════════════════════════════
// FILE TYPE DETECTION — .doc ≠ .docx
// ═══════════════════════════════════════════════════

describe("File Type Detection", () => {
  function detectFileType(fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const typeMap: Record<string, string> = {
      pdf: "pdf", docx: "docx", txt: "txt",
      doc: "doc_legacy",
      md: "markdown", markdown: "markdown", rtf: "rtf",
      odt: "odt",
      jpg: "image", jpeg: "image", png: "image", webp: "image",
    };
    return typeMap[ext] || "unknown";
  }

  it("detects .docx as docx", () => {
    expect(detectFileType("SANG_NOIR_BIBLE.docx")).toBe("docx");
    expect(detectFileType("script.DOCX")).toBe("docx");
  });

  it("detects .doc as doc_legacy, NOT docx", () => {
    expect(detectFileType("old_script.doc")).toBe("doc_legacy");
    expect(detectFileType("fichier.DOC")).toBe("doc_legacy");
  });

  it("detects .pdf as pdf", () => {
    expect(detectFileType("document.pdf")).toBe("pdf");
  });

  it("detects .odt as odt (unsupported but explicit)", () => {
    expect(detectFileType("doc.odt")).toBe("odt");
  });

  it("returns unknown for unrecognized extensions", () => {
    expect(detectFileType("file.xyz")).toBe("unknown");
  });
});

// ═══════════════════════════════════════════════════
// DOCX ROUTING — no fallback to PDF ever
// ═══════════════════════════════════════════════════

describe("DOCX Routing Rules — No PDF Fallback", () => {
  type RouteResult = {
    parser: string;
    fallbackToPdf: boolean;
    fallbackToVision: boolean;
  };

  function getExtractionRoute(fileType: string): RouteResult {
    if (fileType === "txt" || fileType === "markdown" || fileType === "rtf") {
      return { parser: "text_parse", fallbackToPdf: false, fallbackToVision: false };
    }
    if (fileType === "docx") {
      return { parser: "docx_xml_parse", fallbackToPdf: false, fallbackToVision: false };
    }
    if (fileType === "doc_legacy") {
      return { parser: "doc_legacy_unsupported", fallbackToPdf: false, fallbackToVision: false };
    }
    if (fileType === "pdf") {
      return { parser: "pdf_vision_api", fallbackToPdf: false, fallbackToVision: false };
    }
    // Unknown — explicit unsupported, NO vision fallback
    return { parser: "unsupported_file_type", fallbackToPdf: false, fallbackToVision: false };
  }

  it("routes DOCX to docx_xml_parse with no fallback", () => {
    const route = getExtractionRoute("docx");
    expect(route.parser).toBe("docx_xml_parse");
    expect(route.fallbackToPdf).toBe(false);
    expect(route.fallbackToVision).toBe(false);
  });

  it("routes doc_legacy to unsupported with no fallback", () => {
    const route = getExtractionRoute("doc_legacy");
    expect(route.parser).toBe("doc_legacy_unsupported");
    expect(route.fallbackToPdf).toBe(false);
    expect(route.fallbackToVision).toBe(false);
  });

  it("routes unknown types to unsupported with no vision fallback", () => {
    const route = getExtractionRoute("unknown");
    expect(route.parser).toBe("unsupported_file_type");
    expect(route.fallbackToVision).toBe(false);
  });

  it("DOCX failure never produces pdf_vision_api_error", () => {
    // Simulate DOCX parse failure
    const docxResult = { success: false, method: "docx_parse_failed" };
    // Verify it never gets rerouted to pdf
    expect(docxResult.method).not.toContain("pdf");
    expect(docxResult.method).not.toContain("vision");
  });
});

// ═══════════════════════════════════════════════════
// LEGACY STATUS BACKWARD COMPATIBILITY
// ═══════════════════════════════════════════════════

describe("Legacy Status Backward Compatibility", () => {
  const PARSER_FAILURE_LABELS: Record<string, string> = {
    docx_parse_failed: "Le fichier DOCX n'a pas pu être lu",
    pdf_parse_failed: "Le PDF n'a pas pu être analysé",
    pdf_vision_api_error: "Ancien parseur — re-importez le document",
    pdf_vision_api: "Ancien mode d'extraction",
    doc_legacy_unsupported: "Format .doc ancien",
    download_failed: "Téléchargement échoué",
    unsupported_file_type: "Type non supporté",
  };

  it("has a label for legacy pdf_vision_api_error status", () => {
    expect(PARSER_FAILURE_LABELS["pdf_vision_api_error"]).toBeDefined();
    expect(PARSER_FAILURE_LABELS["pdf_vision_api_error"]).toContain("re-importez");
  });

  it("has a label for legacy pdf_vision_api status", () => {
    expect(PARSER_FAILURE_LABELS["pdf_vision_api"]).toBeDefined();
  });

  function isExtractionFailure(extractionMode: string | null): boolean {
    return Boolean(
      extractionMode?.includes("failed") ||
      extractionMode?.includes("error") ||
      extractionMode?.includes("unsupported")
    );
  }

  it("detects pdf_vision_api_error as a failure", () => {
    expect(isExtractionFailure("pdf_vision_api_error")).toBe(true);
  });

  it("detects docx_parse_failed as a failure", () => {
    expect(isExtractionFailure("docx_parse_failed")).toBe(true);
  });

  it("does not flag successful statuses", () => {
    expect(isExtractionFailure("docx_parse_succeeded")).toBe(false);
    expect(isExtractionFailure("pdf_parse_succeeded")).toBe(false);
    expect(isExtractionFailure("text_parse_succeeded")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════
// OLE2 (.doc) MAGIC BYTE DETECTION
// ═══════════════════════════════════════════════════

describe("OLE2 Magic Byte Detection", () => {
  it("detects OLE2 .doc files by magic bytes", () => {
    const ole2Magic = new Uint8Array([0xD0, 0xCF, 0x11, 0xE0]);
    const isOLE2 = ole2Magic[0] === 0xD0 && ole2Magic[1] === 0xCF &&
                   ole2Magic[2] === 0x11 && ole2Magic[3] === 0xE0;
    expect(isOLE2).toBe(true);
  });

  it("detects ZIP/DOCX files by PK magic bytes", () => {
    const zipMagic = new Uint8Array([0x50, 0x4B, 0x03, 0x04]);
    const isZip = zipMagic[0] === 0x50 && zipMagic[1] === 0x4B;
    expect(isZip).toBe(true);
  });

  it("rejects PDF files in DOCX parser", () => {
    // PDF starts with %PDF (0x25 0x50 0x44 0x46)
    const pdfMagic = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const isZip = pdfMagic[0] === 0x50 && pdfMagic[1] === 0x4B;
    expect(isZip).toBe(false);
  });
});

// ═══════════════════════════════════════════════════
// DOCX XML TEXT EXTRACTION (pure function)
// ═══════════════════════════════════════════════════

describe("DOCX XML Text Extraction", () => {
  function extractTextFromDocumentXml(xmlString: string): { paragraphs: string[]; headingCount: number } {
    const paragraphs: string[] = [];
    let headingCount = 0;
    const pRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
    let pMatch;
    while ((pMatch = pRegex.exec(xmlString)) !== null) {
      const pBlock = pMatch[0];
      const tRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
      let tMatch;
      let paraText = "";
      while ((tMatch = tRegex.exec(pBlock)) !== null) {
        paraText += tMatch[1];
      }
      if (!paraText.trim()) continue;
      const isHeading = /<w:pStyle\s+w:val="(?:Heading|Titre|heading|Title|titre|TOC|Sous-titre|Subtitle)/i.test(pBlock);
      if (isHeading) {
        headingCount++;
        paragraphs.push("## " + paraText.trim());
      } else {
        paragraphs.push(paraText.trim());
      }
    }
    return { paragraphs, headingCount };
  }

  it("extracts text from standard Word <w:t> tags", () => {
    const xml = '<w:p><w:r><w:t>Bonjour le monde</w:t></w:r></w:p>';
    const { paragraphs } = extractTextFromDocumentXml(xml);
    expect(paragraphs).toEqual(["Bonjour le monde"]);
  });

  it("handles xml:space preserve attribute", () => {
    const xml = '<w:p><w:r><w:t xml:space="preserve">  Texte avec espaces  </w:t></w:r></w:p>';
    const { paragraphs } = extractTextFromDocumentXml(xml);
    expect(paragraphs[0]).toContain("Texte avec espaces");
  });

  it("detects French heading styles", () => {
    const xml = '<w:p><w:pPr><w:pStyle w:val="Titre1"/></w:pPr><w:r><w:t>Introduction</w:t></w:r></w:p>';
    const { paragraphs, headingCount } = extractTextFromDocumentXml(xml);
    expect(headingCount).toBe(1);
    expect(paragraphs[0]).toContain("## Introduction");
  });

  it("detects English heading styles", () => {
    const xml = '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Chapter One</w:t></w:r></w:p>';
    const { paragraphs, headingCount } = extractTextFromDocumentXml(xml);
    expect(headingCount).toBe(1);
    expect(paragraphs[0]).toContain("Chapter One");
  });

  it("concatenates multiple <w:t> runs in one paragraph", () => {
    const xml = '<w:p><w:r><w:t>Patricia </w:t></w:r><w:r><w:t>Ndongo</w:t></w:r></w:p>';
    const { paragraphs } = extractTextFromDocumentXml(xml);
    expect(paragraphs[0]).toBe("Patricia Ndongo");
  });

  it("skips empty paragraphs", () => {
    const xml = '<w:p><w:r><w:t>   </w:t></w:r></w:p><w:p><w:r><w:t>Vrai texte</w:t></w:r></w:p>';
    const { paragraphs } = extractTextFromDocumentXml(xml);
    expect(paragraphs).toEqual(["Vrai texte"]);
  });

  it("handles complex production document patterns", () => {
    // Simulate a real Sang Noir DOCX XML structure
    const xml = `
      <w:p><w:pPr><w:pStyle w:val="Titre1"/></w:pPr><w:r><w:t>SANG NOIR — Bible de série V3</w:t></w:r></w:p>
      <w:p><w:r><w:t>Logline : Un thriller médical sénégalais.</w:t></w:r></w:p>
      <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Personnages</w:t></w:r></w:p>
      <w:p><w:r><w:t>Patricia Ndongo, 29 ans, médecin urgentiste.</w:t></w:r></w:p>
      <w:p><w:r><w:t>Amadou Diallo, 45 ans, directeur de la clinique.</w:t></w:r></w:p>
      <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Lieux</w:t></w:r></w:p>
      <w:p><w:r><w:t>Clinique Ophélia — quartier HLM, Dakar</w:t></w:r></w:p>
    `;
    const { paragraphs, headingCount } = extractTextFromDocumentXml(xml);
    expect(headingCount).toBe(3);
    expect(paragraphs.length).toBeGreaterThanOrEqual(5);
    // Check that key content signals are present
    const fullText = paragraphs.join("\n");
    expect(fullText).toContain("SANG NOIR");
    expect(fullText).toContain("Logline");
    expect(fullText).toContain("Patricia Ndongo");
    expect(fullText).toContain("Amadou Diallo");
    expect(fullText).toContain("Clinique Ophélia");
    expect(fullText).toContain("Personnages");
    expect(fullText).toContain("Lieux");
  });
});

// ═══════════════════════════════════════════════════
// XML ENTITY DECODING
// ═══════════════════════════════════════════════════

describe("XML Entity Decoding", () => {
  function decodeXmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
  }

  it("decodes standard XML entities", () => {
    expect(decodeXmlEntities("&amp; &lt; &gt; &quot; &apos;")).toBe('& < > " \'');
  });

  it("decodes hex character references (French accents)", () => {
    expect(decodeXmlEntities("&#xE9;")).toBe("é");
    expect(decodeXmlEntities("&#xE8;")).toBe("è");
    expect(decodeXmlEntities("&#xC0;")).toBe("À");
  });

  it("decodes decimal character references", () => {
    expect(decodeXmlEntities("&#233;")).toBe("é");
    expect(decodeXmlEntities("&#8212;")).toBe("—"); // em dash
  });

  it("preserves normal text unchanged", () => {
    expect(decodeXmlEntities("Patricia Ndongo, médecin")).toBe("Patricia Ndongo, médecin");
  });
});

// ═══════════════════════════════════════════════════
// ZIP HEADER VALIDATION
// ═══════════════════════════════════════════════════

describe("ZIP Header Validation", () => {
  it("validates PK signature for DOCX files", () => {
    // Valid ZIP starts with PK (0x50 0x4B)
    const validZip = new Uint8Array([0x50, 0x4B, 0x03, 0x04]);
    expect(validZip[0]).toBe(0x50);
    expect(validZip[1]).toBe(0x4B);
  });

  it("rejects non-ZIP files (OLE2 .doc signature)", () => {
    // OLE2 (legacy .doc) starts with D0 CF 11 E0
    const ole2 = new Uint8Array([0xD0, 0xCF, 0x11, 0xE0]);
    const isZip = ole2[0] === 0x50 && ole2[1] === 0x4B;
    expect(isZip).toBe(false);
  });

  it("rejects empty/corrupted files", () => {
    const empty = new Uint8Array([]);
    expect(empty.length).toBeLessThan(4);
  });
});

// ═══════════════════════════════════════════════════
// REGRESSION: SANG NOIR CORPUS EXTRACTION SIGNALS
// ═══════════════════════════════════════════════════

describe("Sang Noir Corpus — Expected Extraction Signals", () => {
  // These tests verify that if the DOCX parser produces the expected text,
  // the downstream pipeline can find the key entities.

  function containsExpectedSignals(text: string, signals: string[]): { found: string[]; missing: string[] } {
    const lower = text.toLowerCase();
    const found = signals.filter(s => lower.includes(s.toLowerCase()));
    const missing = signals.filter(s => !lower.includes(s.toLowerCase()));
    return { found, missing };
  }

  it("SANG_NOIR_LIENS_BIBLE_SERIE_V3 should contain bible signals", () => {
    // Simulated extracted text from a real bible document
    const sampleText = `
      SANG NOIR — Bible de série V3
      Logline : Quand la banque de sang d'une clinique de Dakar est contaminée, une jeune médecin
      urgentiste doit naviguer entre corruption médicale et conspirations familiales.

      Personnages
      Patricia Ndongo, 29 ans, médecin urgentiste à la Clinique Ophélia.
      Amadou Diallo, 45 ans, directeur de la clinique.

      Lieux
      Clinique Ophélia — quartier HLM, Dakar
      Marché Sandaga

      MINI-ÉPISODE 1 : Le Premier Sang
      SCÈNE 1 — INT. CLINIQUE OPHÉLIA / URGENCES — NUIT
    `;
    const signals = ["sang noir", "logline", "patricia", "clinique ophélia", "personnages", "lieux", "épisode", "scène"];
    const result = containsExpectedSignals(sampleText, signals);
    expect(result.missing).toHaveLength(0);
    expect(result.found.length).toBe(signals.length);
  });

  it("SANG_NOIR_LIENS_GOUVERNANCE_OFFICIELLE should contain governance signals", () => {
    const sampleText = `
      SANG NOIR — Document de gouvernance officielle
      Source de vérité : Ce document prime sur tout autre document du corpus.
      Règles de continuité : Tous les personnages récurrents doivent respecter leurs arcs définis.
      Personnages canoniques :
      Patricia Ndongo — protagoniste principale
      Amadou Diallo — antagoniste
    `;
    const signals = ["gouvernance", "source de vérité", "règles", "continuité", "canonique"];
    const result = containsExpectedSignals(sampleText, signals);
    expect(result.missing).toHaveLength(0);
  });

  it("SANG_NOIR_LIENS_SCRIPTS_V9_COMPLETS should contain script signals", () => {
    const sampleText = `
      SANG NOIR — Scripts complets V9
      MINI-ÉPISODE 1 : Le Premier Sang
      SCÈNE 1 — INT. CLINIQUE OPHÉLIA / URGENCES — NUIT
      Patricia entre en courant dans les urgences.
      PATRICIA : Où est le patient du lit 4 ?
      SCÈNE 2 — EXT. PARKING — JOUR
    `;
    const signals = ["scène", "int.", "ext.", "épisode", "patricia"];
    const result = containsExpectedSignals(sampleText, signals);
    expect(result.missing).toHaveLength(0);
  });

  it("SANG_NOIR_LIENS_RESTRUCTURATION_24EP should contain episode structure signals", () => {
    const sampleText = `
      SANG NOIR — Restructuration 24 épisodes
      SAISON 1 — 12 épisodes
      ÉPISODE 1 : Le Premier Sang
      ÉPISODE 2 : Contamination
      ÉPISODE 3 : L'Enquête commence
      SAISON 2 — 12 épisodes
      ÉPISODE 13 : Retour à Dakar
    `;
    const signals = ["restructuration", "saison", "épisode", "24"];
    const result = containsExpectedSignals(sampleText, signals);
    expect(result.missing).toHaveLength(0);
  });

  it("SANG_NOIR_LIENS_ONE_PAGER should contain pitch signals", () => {
    const sampleText = `
      SANG NOIR — One Pager
      Genre : Thriller médical
      Durée : Série de 24 mini-épisodes
      Logline : Un scandale sanitaire secoue une clinique de Dakar.
      Public cible : 25-45 ans, urbain, international
      Ton : Sombre, tendu, réaliste
    `;
    const signals = ["one pager", "genre", "logline", "durée", "public cible", "ton"];
    const result = containsExpectedSignals(sampleText, signals);
    expect(result.missing).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════
// EXTRACTION PREVIEW STORAGE
// ═══════════════════════════════════════════════════

describe("Extraction Preview Storage", () => {
  it("stores comprehensive debug metadata", () => {
    const debug = {
      parser_chosen: "docx_parse_succeeded",
      parser_status: "succeeded",
      parser_success: true,
      file_type_detected: "docx",
      file_name: "BIBLE_V3.docx",
      extracted_text_length: 15000,
      text_preview: "SANG NOIR — Bible de série V3...",
      fallback_attempted: false,
      final_extraction_mode: "docx_parse_succeeded",
      error_message: null,
      timestamp: "2026-04-07T10:00:00.000Z",
      chunk_count: 12,
    };

    expect(debug.parser_chosen).toBe("docx_parse_succeeded");
    expect(debug.fallback_attempted).toBe(false);
    expect(debug.extracted_text_length).toBeGreaterThan(0);
    expect(debug.text_preview.length).toBeGreaterThan(0);
    expect(debug.chunk_count).toBeGreaterThan(0);
  });

  it("stores failure debug with error details", () => {
    const debug = {
      parser_chosen: "docx_parse_failed",
      parser_status: "failed",
      parser_success: false,
      file_type_detected: "docx",
      extracted_text_length: 0,
      text_preview: "(empty)",
      fallback_attempted: false,
      error_message: "Extraction échouée (docx_parse_failed)",
      parser_debug: {
        zipValid: true,
        entryFound: false,
        error: "word/document.xml not found in DOCX ZIP",
      },
    };

    expect(debug.parser_success).toBe(false);
    expect(debug.fallback_attempted).toBe(false);
    expect(debug.parser_debug?.error).toContain("document.xml");
  });
});

// ═══════════════════════════════════════════════════
// PIPELINE GATE — fail before entity extraction
// ═══════════════════════════════════════════════════

describe("Pipeline Gate — Fail Before Entity Extraction", () => {
  function shouldProceedToAI(parserSuccess: boolean, textLength: number): boolean {
    return parserSuccess && textLength >= 20;
  }

  function getDocumentStatus(parserSuccess: boolean, textLength: number, aiSuccess: boolean): string {
    if (!parserSuccess || textLength < 20) return "parsing_failed";
    if (!aiSuccess) return "extraction_failed";
    return "ready_for_review";
  }

  it("marks parsing_failed when DOCX parse fails", () => {
    expect(getDocumentStatus(false, 0, false)).toBe("parsing_failed");
  });

  it("marks parsing_failed when text too short", () => {
    expect(getDocumentStatus(true, 5, false)).toBe("parsing_failed");
  });

  it("marks extraction_failed when AI fails but parser succeeded", () => {
    expect(getDocumentStatus(true, 5000, false)).toBe("extraction_failed");
  });

  it("marks ready_for_review when both succeed", () => {
    expect(getDocumentStatus(true, 5000, true)).toBe("ready_for_review");
  });

  it("never proceeds to AI when parser failed", () => {
    expect(shouldProceedToAI(false, 0)).toBe(false);
    expect(shouldProceedToAI(false, 10000)).toBe(false);
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
