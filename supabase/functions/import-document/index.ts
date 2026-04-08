import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import pako from "https://esm.sh/pako@2.1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Parser version — increment when extraction pipeline changes materially
const PARSER_VERSION = "2.0.0";

// Legacy extraction modes from older parser versions
const LEGACY_EXTRACTION_MODES = [
  "pdf_vision_api_error",
  "pdf_vision_api",
  "vision_api",
  "pdf_vision",
] as const;

function isLegacyDocument(doc: Record<string, unknown>): boolean {
  const mode = doc.extraction_mode as string | null;
  if (!mode) return false;
  // Explicit legacy modes from old parser
  if (LEGACY_EXTRACTION_MODES.some(m => mode === m || mode.startsWith(m))) return true;
  // Documents without parser_version in metadata were processed by old parser
  const meta = doc.metadata as Record<string, unknown> | null;
  const debug = meta?.extraction_debug as Record<string, unknown> | undefined;
  if (debug && !debug.parser_version) return true;
  return false;
}

const DOCUMENT_ROLES = [
  "script_master","episode_script","film_script","music_video_concept",
  "series_bible","short_pitch","producer_bible","one_pager",
  "continuity_doc","governance_doc","character_sheet","world_pack_doc",
  "moodboard_doc","wardrobe_doc","music_doc","lyric_doc",
  "production_notes","legal_notes","reference_images","unknown",
] as const;

const PRIORITY_ORDER: Record<string, number> = {
  source_of_truth: 5,
  preferred_source: 4,
  supporting_reference: 3,
  draft_only: 2,
  deprecated: 1,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const { action } = body;

    if (action === "batch_process") return await batchProcess(supabase, body, user.id);
    if (action === "detect_conflicts") return await detectConflicts(supabase, body.project_id, user.id);
    if (action === "detect_missing") return await detectMissingInfo(supabase, body.project_id, user.id);
    if (action === "retrieve_context") return await retrieveContext(supabase, body);
    if (action === "extract" && body.document_id) return await processDocument(supabase, body.document_id, user.id);
    if (action === "reprocess" && body.document_id) return await reprocessDocument(supabase, body.document_id, user.id);
    if (action === "reprocess_legacy") return await reprocessLegacyDocuments(supabase, body, user.id);
    if (action === "wizard_extract") return await wizardExtract(supabase, body, user.id);
    if (action === "debug_document") return await debugDocument(supabase, body.document_id);
    if (action === "apply_corpus") return await applyCorpus(supabase, body.project_id, user.id);
    if (action === "project_brain_summary") return await projectBrainSummary(supabase, body.project_id, user.id);

    // Register + auto-extract a new document
    const { project_id, series_id, file_name, file_type, file_size_bytes, storage_path } = body;
    if (!file_name || !storage_path) throw new Error("file_name and storage_path required");

    const detectedType = detectFileType(file_name);
    const isImage = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff"].includes(
      file_name.split(".").pop()?.toLowerCase() || ""
    );

    const { data: doc, error: docErr } = await supabase
      .from("source_documents")
      .insert({
        project_id: project_id || null,
        series_id: series_id || null,
        uploaded_by: user.id,
        file_name,
        file_type: detectedType,
        file_size_bytes: file_size_bytes || 0,
        storage_path,
        status: "uploaded",
        document_role: isImage ? "reference_images" : "unknown",
        role_confidence: isImage ? 0.9 : 0,
      })
      .select()
      .single();
    if (docErr) throw docErr;

    const extractResult = await processDocument(supabase, doc.id, user.id);
    const extractData = await extractResult.json();

    return new Response(JSON.stringify({
      document_id: doc.id,
      status: "processed",
      ...extractData,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("import-document error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function detectFileType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const typeMap: Record<string, string> = {
    pdf: "pdf", docx: "docx", txt: "txt",
    doc: "doc_legacy",  // Legacy .doc is OLE2 binary, NOT ZIP — must never enter DOCX parser
    md: "markdown", markdown: "markdown", rtf: "rtf",
    odt: "odt",  // OpenDocument — unsupported, explicit type
    jpg: "image", jpeg: "image", png: "image", webp: "image",
    gif: "image", bmp: "image", tiff: "image",
    mp3: "audio", wav: "audio", m4a: "audio", flac: "audio",
    mp4: "video", mov: "video", avi: "video", mkv: "video",
  };
  return typeMap[ext] || "unknown";
}

// ═══════════════════════════════════════════════════
// PARSER STATUS CODES — truthful, granular statuses
// ═══════════════════════════════════════════════════
const PARSER_STATUS = {
  // DOCX statuses
  DOCX_PARSE_STARTED: "docx_parse_started",
  DOCX_PARSE_SUCCEEDED: "docx_parse_succeeded",
  DOCX_PARSE_FAILED: "docx_parse_failed",
  // PDF statuses
  PDF_PARSE_STARTED: "pdf_parse_started",
  PDF_PARSE_SUCCEEDED: "pdf_parse_succeeded",
  PDF_PARSE_FAILED: "pdf_parse_failed",
  // Plain text
  TEXT_PARSE_SUCCEEDED: "text_parse_succeeded",
  TEXT_PARSE_FAILED: "text_parse_failed",
  // General
  UNSUPPORTED_FILE_TYPE: "unsupported_file_type",
  DOWNLOAD_FAILED: "download_failed",
  // Legacy
  DOC_LEGACY_UNSUPPORTED: "doc_legacy_unsupported",
} as const;

// ═══════════════════════════════════════════════════
// TEXT EXTRACTION — production-hardened DOCX pipeline
// ═══════════════════════════════════════════════════

/**
 * Read a 16-bit little-endian unsigned int from a buffer.
 */
function readU16(buf: Uint8Array, off: number): number {
  return buf[off] | (buf[off + 1] << 8);
}

/**
 * Read a 32-bit little-endian unsigned int from a buffer.
 */
function readU32(buf: Uint8Array, off: number): number {
  return (buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24)) >>> 0;
}

/**
 * Minimal ZIP reader: extract a single named entry from a ZIP archive.
 * Handles standard ZIP and tolerates minor ZIP64 edge cases.
 */
async function zipExtractEntry(
  zipData: Uint8Array,
  targetName: string
): Promise<{ data: Uint8Array; found: boolean; error?: string }> {
  try {
    // Find End of Central Directory (EOCD) — scan backwards from end
    let eocdOffset = -1;
    const searchStart = Math.max(0, zipData.length - 65557);
    for (let i = zipData.length - 22; i >= searchStart; i--) {
      if (zipData[i] === 0x50 && zipData[i + 1] === 0x4B &&
          zipData[i + 2] === 0x05 && zipData[i + 3] === 0x06) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset === -1) {
      return { data: new Uint8Array(), found: false, error: "No EOCD record — not a valid ZIP file" };
    }

    let cdOffset = readU32(zipData, eocdOffset + 16);
    let cdEntries = readU16(zipData, eocdOffset + 10);

    // Check for ZIP64 EOCD locator (immediately before EOCD)
    if (cdOffset === 0xFFFFFFFF || cdEntries === 0xFFFF) {
      // Try ZIP64 end of central directory locator
      const z64LocOff = eocdOffset - 20;
      if (z64LocOff >= 0 && readU32(zipData, z64LocOff) === 0x07064B50) {
        // ZIP64 locator found — read the ZIP64 EOCD
        const z64EocdOff = Number(
          BigInt(readU32(zipData, z64LocOff + 8)) |
          (BigInt(readU32(zipData, z64LocOff + 12)) << 32n)
        );
        if (z64EocdOff >= 0 && z64EocdOff + 56 <= zipData.length &&
            readU32(zipData, z64EocdOff) === 0x06064B50) {
          cdEntries = Number(
            BigInt(readU32(zipData, z64EocdOff + 32)) |
            (BigInt(readU32(zipData, z64EocdOff + 36)) << 32n)
          );
          cdOffset = Number(
            BigInt(readU32(zipData, z64EocdOff + 48)) |
            (BigInt(readU32(zipData, z64EocdOff + 52)) << 32n)
          );
        }
      }
    }

    if (cdOffset >= zipData.length) {
      return { data: new Uint8Array(), found: false, error: `Central directory offset ${cdOffset} beyond file size ${zipData.length}` };
    }

    // Parse central directory entries
    let offset = cdOffset;
    for (let entry = 0; entry < cdEntries; entry++) {
      if (offset + 46 > zipData.length) break;
      const sig = readU32(zipData, offset);
      if (sig !== 0x02014B50) break;

      const method = readU16(zipData, offset + 10);
      const compSize = readU32(zipData, offset + 20);
      const uncompSize = readU32(zipData, offset + 24);
      const nameLen = readU16(zipData, offset + 28);
      const extraLen = readU16(zipData, offset + 30);
      const commentLen = readU16(zipData, offset + 32);
      const localHeaderOffset = readU32(zipData, offset + 42);

      const nameBytes = zipData.slice(offset + 46, offset + 46 + nameLen);
      const fileName = new TextDecoder().decode(nameBytes);

      if (fileName === targetName) {
        // Found it — read local file header
        if (localHeaderOffset + 30 > zipData.length) {
          return { data: new Uint8Array(), found: false, error: `Local header offset ${localHeaderOffset} out of bounds` };
        }
        const localSig = readU32(zipData, localHeaderOffset);
        if (localSig !== 0x04034B50) {
          return { data: new Uint8Array(), found: false, error: "Invalid local file header signature" };
        }
        const localNameLen = readU16(zipData, localHeaderOffset + 26);
        const localExtraLen = readU16(zipData, localHeaderOffset + 28);
        const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;

        if (method === 0) {
          // Stored (uncompressed)
          return { data: zipData.slice(dataStart, dataStart + uncompSize), found: true };
        } else if (method === 8) {
          // DEFLATE — try multiple decompression strategies (pako first, then DecompressionStream)
          const compressedData = zipData.slice(dataStart, dataStart + compSize);
          console.log(`[ZIP] Decompressing ${targetName}: compressed=${compSize} bytes, uncompressed=${uncompSize} bytes`);
          const { data: decompressed, strategy } = await decompressDeflate(compressedData);
          if (decompressed && decompressed.length > 0) {
            console.log(`[ZIP] Decompression OK via ${strategy}: got ${decompressed.length} bytes`);
            return { data: decompressed, found: true };
          }
          return { data: new Uint8Array(), found: false, error: `DEFLATE decompression failed for all strategies (compressed=${compSize}, expected=${uncompSize})` };
        } else {
          return { data: new Uint8Array(), found: false, error: `Unsupported compression method: ${method}` };
        }
      }

      offset += 46 + nameLen + extraLen + commentLen;
    }

    return { data: new Uint8Array(), found: false, error: `Entry "${targetName}" not found in ZIP` };
  } catch (e) {
    return { data: new Uint8Array(), found: false, error: `ZIP read error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * Decompress DEFLATE data. Uses pako (pure-JS zlib) as primary strategy,
 * with DecompressionStream as fallback.
 *
 * CRITICAL: DecompressionStream("deflate-raw") is unreliable in Deno Edge Functions.
 * pako.inflateRaw() is proven and works everywhere.
 */
async function decompressDeflate(compressed: Uint8Array): Promise<{ data: Uint8Array | null; strategy: string }> {
  // Strategy 1: pako.inflateRaw (pure JS — works everywhere, correct for ZIP raw deflate)
  try {
    const result = pako.inflateRaw(compressed);
    if (result && result.length > 0) {
      console.log(`[DECOMPRESS] pako.inflateRaw succeeded: ${compressed.length} → ${result.length} bytes`);
      return { data: result, strategy: "pako_inflate_raw" };
    }
  } catch (e) {
    console.warn(`[DECOMPRESS] pako.inflateRaw failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Strategy 2: pako.inflate (zlib-wrapped — some DOCX generators add zlib header)
  try {
    const result = pako.inflate(compressed);
    if (result && result.length > 0) {
      console.log(`[DECOMPRESS] pako.inflate succeeded: ${compressed.length} → ${result.length} bytes`);
      return { data: result, strategy: "pako_inflate_zlib" };
    }
  } catch (e) {
    console.warn(`[DECOMPRESS] pako.inflate failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Strategy 3: DecompressionStream("deflate-raw") — native, if available
  try {
    const result = await decompressWithStream("deflate-raw", compressed);
    if (result && result.length > 0) {
      console.log(`[DECOMPRESS] DecompressionStream(deflate-raw) succeeded: ${result.length} bytes`);
      return { data: result, strategy: "stream_deflate_raw" };
    }
  } catch (e) {
    console.warn(`[DECOMPRESS] DecompressionStream(deflate-raw) failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Strategy 4: DecompressionStream("deflate") — zlib-wrapped
  try {
    const result = await decompressWithStream("deflate", compressed);
    if (result && result.length > 0) {
      console.log(`[DECOMPRESS] DecompressionStream(deflate) succeeded: ${result.length} bytes`);
      return { data: result, strategy: "stream_deflate" };
    }
  } catch (e) {
    console.warn(`[DECOMPRESS] DecompressionStream(deflate) failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  console.error("[DECOMPRESS] ALL decompression strategies failed for DEFLATE data");
  return { data: null, strategy: "all_failed" };
}

async function decompressWithStream(format: CompressionFormat | string, data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream(format as CompressionFormat);
  const writer = ds.writable.getWriter();
  const writePromise = writer.write(data as unknown as BufferSource).then(() => writer.close());
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (value) chunks.push(value);
    if (done) break;
  }
  await writePromise;
  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLen);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
}

/**
 * Extract text from Word XML (word/document.xml).
 * Handles multiple namespace conventions used by different Word versions.
 */
function extractTextFromDocumentXml(xmlString: string): { paragraphs: string[]; headingCount: number } {
  const paragraphs: string[] = [];
  let headingCount = 0;

  // Match <w:p> paragraphs — use [\s\S] instead of [^] for cross-engine compat
  const pRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let pMatch;
  while ((pMatch = pRegex.exec(xmlString)) !== null) {
    const pBlock = pMatch[0];

    // Extract all <w:t> text runs within this paragraph
    // Match both <w:t>text</w:t> and <w:t xml:space="preserve">text</w:t>
    const tRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    let tMatch;
    let paraText = "";
    while ((tMatch = tRegex.exec(pBlock)) !== null) {
      paraText += tMatch[1];
    }

    if (!paraText.trim()) continue;

    // Detect headings: multiple naming conventions across Word versions/locales
    const isHeading = /<w:pStyle\s+w:val="(?:Heading|Titre|heading|Title|titre|TOC|Sous-titre|Subtitle)/i.test(pBlock);
    const headingLevel = pBlock.match(/<w:pStyle\s+w:val="(?:Heading|Titre)(\d)/i)?.[1];

    if (isHeading) {
      headingCount++;
      const prefix = headingLevel ? "#".repeat(Math.min(Number(headingLevel), 4)) : "##";
      paragraphs.push(`\n${prefix} ${paraText.trim()}`);
    } else {
      paragraphs.push(paraText.trim());
    }
  }

  return { paragraphs, headingCount };
}

/**
 * Decode XML entities in extracted text.
 */
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

/**
 * Extract text from a DOCX file by parsing the ZIP and reading word/document.xml.
 * Production-hardened: handles ZIP64, multiple compression strategies,
 * namespace variations, and French Word documents.
 *
 * NEVER falls back to PDF Vision. If this fails, it fails honestly.
 */
async function extractDocxText(fileBytes: Uint8Array): Promise<{
  text: string;
  method: string;
  success: boolean;
  debug: {
    zipValid: boolean;
    entryFound: boolean;
    xmlLength: number;
    paragraphCount: number;
    headingCount: number;
    decompressionStrategy?: string;
    error?: string;
  };
}> {
  const debug = {
    zipValid: false,
    entryFound: false,
    xmlLength: 0,
    paragraphCount: 0,
    headingCount: 0,
    decompressionStrategy: undefined as string | undefined,
    error: undefined as string | undefined,
  };

  try {
    console.log(`[DOCX] Starting extraction: ${fileBytes.length} bytes`);

    // Detect MIME type from magic bytes
    const magicHex = Array.from(fileBytes.slice(0, 8)).map(b => b.toString(16).padStart(2, "0")).join(" ");
    (debug as Record<string, unknown>).magicBytes = magicHex;
    console.log(`[DOCX] Magic bytes: ${magicHex}`);

    // Validate it's actually a ZIP file (PK signature)
    if (fileBytes.length < 4 || fileBytes[0] !== 0x50 || fileBytes[1] !== 0x4B) {
      // Check for OLE2 (.doc) magic: D0 CF 11 E0
      if (fileBytes[0] === 0xD0 && fileBytes[1] === 0xCF && fileBytes[2] === 0x11 && fileBytes[3] === 0xE0) {
        debug.error = "File is OLE2 binary (.doc), not DOCX (.docx ZIP). Convert to .docx first.";
      } else {
        debug.error = `File does not start with PK signature (got ${magicHex}) — not a ZIP/DOCX file`;
      }
      console.error(`[DOCX] FAILED: ${debug.error}`);
      return { text: "", method: PARSER_STATUS.DOCX_PARSE_FAILED, success: false, debug };
    }
    debug.zipValid = true;
    console.log(`[DOCX] ZIP signature valid (PK)`);

    // Extract word/document.xml from ZIP — try primary path, then fallback
    let entry = await zipExtractEntry(fileBytes, "word/document.xml");
    if (!entry.found) {
      console.warn(`[DOCX] word/document.xml not found, trying word/document2.xml`);
      entry = await zipExtractEntry(fileBytes, "word/document2.xml");
    }
    if (!entry.found) {
      debug.error = entry.error || "Neither word/document.xml nor word/document2.xml found in DOCX ZIP";
      console.error(`[DOCX] FAILED: ${debug.error}`);
      return { text: "", method: PARSER_STATUS.DOCX_PARSE_FAILED, success: false, debug };
    }
    debug.entryFound = true;
    console.log(`[DOCX] XML entry found: ${entry.data.length} bytes`);

    const xmlString = new TextDecoder("utf-8").decode(entry.data);
    debug.xmlLength = xmlString.length;

    if (xmlString.length < 50) {
      debug.error = `document.xml too small (${xmlString.length} bytes) — likely empty document`;
      console.error(`[DOCX] FAILED: ${debug.error}`);
      return { text: "", method: PARSER_STATUS.DOCX_PARSE_FAILED, success: false, debug };
    }
    console.log(`[DOCX] XML decoded: ${xmlString.length} chars`);

    // Extract text from XML
    const { paragraphs, headingCount } = extractTextFromDocumentXml(xmlString);
    debug.paragraphCount = paragraphs.length;
    debug.headingCount = headingCount;
    console.log(`[DOCX] Parsed: ${paragraphs.length} paragraphs, ${headingCount} headings`);

    // Decode XML entities
    const text = decodeXmlEntities(paragraphs.join("\n"));

    if (text.length < 20) {
      debug.error = `Extracted text too short (${text.length} chars) — document may be empty or image-only`;
      console.error(`[DOCX] FAILED: ${debug.error}`);
      return { text, method: PARSER_STATUS.DOCX_PARSE_FAILED, success: false, debug };
    }

    console.log(`[DOCX] SUCCESS: ${text.length} chars, ${paragraphs.length} paragraphs, ${headingCount} headings`);
    return { text, method: PARSER_STATUS.DOCX_PARSE_SUCCEEDED, success: true, debug };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    const errStack = e instanceof Error ? e.stack?.slice(0, 500) : undefined;
    console.error(`[DOCX] EXCEPTION: ${errMsg}`);
    if (errStack) console.error(`[DOCX] Stack: ${errStack}`);
    debug.error = errMsg.slice(0, 300);
    (debug as Record<string, unknown>).stack = errStack;
    return { text: "", method: PARSER_STATUS.DOCX_PARSE_FAILED, success: false, debug };
  }
}

/**
 * Extract text from a PDF using Gemini Vision API.
 * Sends the raw PDF as base64 inline_data to Gemini which can natively read PDFs.
 * Only called for actual PDF files — never for DOCX.
 */
async function extractPdfText(fileBytes: Uint8Array): Promise<{ text: string; method: string; success: boolean }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return { text: "", method: "no_api_key", success: false };
  }

  try {
    // Convert to base64
    let binary = "";
    const len = fileBytes.byteLength;
    const CHUNK = 8192;
    for (let i = 0; i < len; i += CHUNK) {
      const slice = fileBytes.subarray(i, Math.min(i + CHUNK, len));
      for (let j = 0; j < slice.length; j++) {
        binary += String.fromCharCode(slice[j]);
      }
    }
    const base64Pdf = btoa(binary);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extrais TOUT le texte de ce document PDF. Préserve la structure : titres, sections, paragraphes, listes, tableaux. Retourne UNIQUEMENT le texte extrait, sans commentaire ni formatage markdown excessif. Préserve les noms propres, les accents et la ponctuation exactement comme dans le document.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${base64Pdf}`
                }
              }
            ]
          }
        ],
        temperature: 0.05,
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("PDF extraction API error:", response.status, errText);
      return { text: "", method: PARSER_STATUS.PDF_PARSE_FAILED, success: false };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    if (text.length < 20) {
      return { text: "", method: PARSER_STATUS.PDF_PARSE_FAILED, success: false };
    }

    return { text, method: PARSER_STATUS.PDF_PARSE_SUCCEEDED, success: true };
  } catch (e) {
    console.error("PDF Vision extraction error:", e);
    return { text: "", method: PARSER_STATUS.PDF_PARSE_FAILED, success: false };
  }
}

/**
 * Unified text extraction dispatcher.
 * Routes to the correct extractor based on file type.
 *
 * CRITICAL ROUTING RULES:
 * - docx → extractDocxText() ONLY. Never falls back to PDF Vision.
 * - doc_legacy → immediate failure with explicit status. Never sent to DOCX or PDF parser.
 * - pdf → extractPdfText() ONLY.
 * - unknown → explicit unsupported_file_type failure. Never auto-falls-back to Vision API.
 */
async function extractTextFromFile(
  fileData: Blob,
  fileType: string,
  fileName: string
): Promise<{
  text: string;
  method: string;
  success: boolean;
  charCount: number;
  parserDebug?: Record<string, unknown>;
}> {
  console.log(`══════════════════════════════════════════════════`);
  console.log(`[ROUTER] DOCUMENT INGESTION STARTED`);
  console.log(`[ROUTER]   fileName   = ${fileName}`);
  console.log(`[ROUTER]   fileType   = ${fileType}`);
  console.log(`[ROUTER]   blobSize   = ${fileData.size} bytes`);
  console.log(`[ROUTER]   blobType   = ${fileData.type || "(no MIME)"}`);
  console.log(`══════════════════════════════════════════════════`);

  // Plain text files
  if (fileType === "txt" || fileType === "markdown" || fileType === "rtf") {
    const text = await fileData.text();
    const success = text.length > 0;
    return {
      text,
      method: success ? PARSER_STATUS.TEXT_PARSE_SUCCEEDED : PARSER_STATUS.TEXT_PARSE_FAILED,
      success,
      charCount: text.length,
    };
  }

  const bytes = new Uint8Array(await fileData.arrayBuffer());

  // ══════════════════════════════════════════════════════════
  // DOCX — ZIP+XML parser ONLY. NEVER falls back to PDF Vision.
  // ══════════════════════════════════════════════════════════
  if (fileType === "docx") {
    console.log(`[ROUTER] ➜ DOCX parser selected for ${fileName} (${bytes.length} bytes)`);
    console.log(`[ROUTER]   NOTE: DOCX NEVER falls back to PDF Vision. If this fails, it fails honestly.`);
    const result = await extractDocxText(bytes);
    console.log(`[ROUTER] DOCX RESULT:`);
    console.log(`[ROUTER]   method  = ${result.method}`);
    console.log(`[ROUTER]   success = ${result.success}`);
    console.log(`[ROUTER]   chars   = ${result.text.length}`);
    console.log(`[ROUTER]   debug   = ${JSON.stringify(result.debug).slice(0, 300)}`);
    return {
      text: result.text,
      method: result.method,
      success: result.success,
      charCount: result.text.length,
      parserDebug: result.debug,
    };
  }

  // ══════════════════════════════════════════════════════════
  // Legacy .doc — OLE2 binary, NOT supported by ZIP parser.
  // Explicit failure — never silently routes elsewhere.
  // ══════════════════════════════════════════════════════════
  if (fileType === "doc_legacy") {
    console.warn(`[ROUTER] Legacy .doc file detected: ${fileName}. OLE2 format not supported.`);
    return {
      text: "",
      method: PARSER_STATUS.DOC_LEGACY_UNSUPPORTED,
      success: false,
      charCount: 0,
      parserDebug: {
        reason: "Legacy .doc (OLE2 binary) format is not supported. Please convert to .docx (Office Open XML).",
        fileName,
        fileSize: bytes.length,
      },
    };
  }

  // ══════════════════════════════════════════════════════════
  // PDF — Vision API extraction.
  // ══════════════════════════════════════════════════════════
  if (fileType === "pdf") {
    console.log(`[ROUTER] Entering PDF parser for ${fileName} (${bytes.length} bytes)`);
    const result = await extractPdfText(bytes);
    console.log(`[ROUTER] PDF result: method=${result.method} success=${result.success} chars=${result.text.length}`);
    return { ...result, charCount: result.text.length };
  }

  // ══════════════════════════════════════════════════════════
  // UNSUPPORTED — explicit failure. No silent fallback to Vision API.
  // ══════════════════════════════════════════════════════════
  console.warn(`[ROUTER] Unsupported file type "${fileType}" for ${fileName}. No parser available.`);
  return {
    text: "",
    method: PARSER_STATUS.UNSUPPORTED_FILE_TYPE,
    success: false,
    charCount: 0,
    parserDebug: {
      reason: `File type "${fileType}" is not supported for text extraction.`,
      fileName,
      detectedType: fileType,
    },
  };
}

// ═══════════════════════════════════════════════════
// STRUCTURE-AWARE CHUNKING
// ═══════════════════════════════════════════════════

interface TextChunk {
  content: string;
  sectionType: string;
  sectionTitle?: string;
}

/**
 * Split text into structural chunks based on headings, scene markers, etc.
 * Falls back to fixed-size if no structure is detected.
 */
function splitIntoStructuredChunks(text: string, maxLen = 3000): TextChunk[] {
  const chunks: TextChunk[] = [];
  
  // Patterns for structural splitting (French creative docs)
  const structurePatterns = [
    /^#{1,3}\s+.+/m,                              // Markdown headings
    /^(?:SCÈNE|SCENE|SÉQUENCE)\s*\d/im,            // Scene markers
    /^(?:ÉPISODE|EPISODE|MINI-ÉPISODE)\s*\d/im,    // Episode markers
    /^(?:ACTE|ACT)\s*(?:I|II|III|IV|V|\d)/im,      // Act markers
    /^(?:CHAPITRE|CHAPTER)\s*\d/im,                // Chapter markers
    /^(?:PERSONNAGES?|CHARACTERS?)\s*$/im,          // Character section
    /^(?:LIEUX|LOCATIONS?|DÉCORS?)\s*$/im,          // Location section
    /^(?:INT\.|EXT\.)\s+/m,                        // Screenplay INT/EXT
    /^(?:LOGLINE|PITCH|SYNOPSIS|RÉSUMÉ)\s*[:\-—]?\s*$/im, // Key sections
    /^(?:SAISON|SEASON)\s*\d/im,                   // Season markers
  ];

  // Check if the text has structural markers
  const hasStructure = structurePatterns.some(p => p.test(text));

  if (hasStructure) {
    // Split by structural markers
    const splitRegex = /^(#{1,3}\s+.+|(?:SCÈNE|SCENE|SÉQUENCE|ÉPISODE|EPISODE|MINI-ÉPISODE|ACTE|ACT|CHAPITRE|CHAPTER|PERSONNAGES?|CHARACTERS?|LIEUX|LOCATIONS?|DÉCORS?|LOGLINE|PITCH|SYNOPSIS|RÉSUMÉ|SAISON|SEASON)\s*.+|(?:INT\.|EXT\.)\s+.+)/im;
    
    const lines = text.split("\n");
    let currentChunk = "";
    let currentSection = "header";
    let currentTitle = "";

    for (const line of lines) {
      if (splitRegex.test(line.trim()) && currentChunk.trim().length > 50) {
        // Save current chunk
        chunks.push({
          content: currentChunk.trim(),
          sectionType: currentSection,
          sectionTitle: currentTitle || undefined,
        });
        currentChunk = line + "\n";
        currentTitle = line.trim();
        // Determine section type
        if (/scène|scene|séquence|int\.|ext\./i.test(line)) currentSection = "scene";
        else if (/épisode|episode|mini-épisode/i.test(line)) currentSection = "episode";
        else if (/personnage|character/i.test(line)) currentSection = "characters";
        else if (/lieu|location|décor/i.test(line)) currentSection = "locations";
        else if (/logline|pitch|synopsis|résumé/i.test(line)) currentSection = "synopsis";
        else if (/acte|act|chapitre|chapter/i.test(line)) currentSection = "act";
        else if (/saison|season/i.test(line)) currentSection = "season";
        else currentSection = "body";
      } else {
        currentChunk += line + "\n";
        // Split if chunk is too long
        if (currentChunk.length > maxLen) {
          chunks.push({
            content: currentChunk.trim(),
            sectionType: currentSection,
            sectionTitle: currentTitle || undefined,
          });
          currentChunk = "";
        }
      }
    }
    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        sectionType: currentSection,
        sectionTitle: currentTitle || undefined,
      });
    }
  }

  // Fallback or supplement with fixed-size chunks
  if (chunks.length === 0) {
    let i = 0;
    while (i < text.length) {
      // Try to break at paragraph boundaries
      let end = Math.min(i + maxLen, text.length);
      if (end < text.length) {
        const lastPara = text.lastIndexOf("\n\n", end);
        if (lastPara > i + maxLen * 0.5) end = lastPara;
        else {
          const lastNewline = text.lastIndexOf("\n", end);
          if (lastNewline > i + maxLen * 0.5) end = lastNewline;
        }
      }
      chunks.push({
        content: text.slice(i, end).trim(),
        sectionType: i === 0 ? "header" : "body",
      });
      i = end;
    }
  }

  return chunks.length > 0 ? chunks : [{ content: text || "", sectionType: "body" }];
}

// ═══════════════════════════════════════════════════
// WORKFLOW PROMPTS
// ═══════════════════════════════════════════════════

function getWorkflowPrompt(projectType: string): string {
  const base = `Tu es un expert en ingestion de documents pour un studio de production audiovisuelle IA.
Tu analyses des documents de production français et internationaux.

ÉTAPE 1 — CLASSIFICATION DU DOCUMENT
Classe le document dans l'un de ces rôles :
${DOCUMENT_ROLES.join(", ")}

Signaux de classification :
- Présence de "SCÈNE", "INT.", "EXT." → script_master ou episode_script
- Présence de descriptions de personnages détaillées → character_sheet ou series_bible
- Présence de "LOGLINE", "PITCH", "SYNOPSIS" → short_pitch ou one_pager
- Présence de "GOUVERNANCE", "SOURCE DE VÉRITÉ", "RÈGLES" → governance_doc
- Présence de "SAISON", "ÉPISODE", structures narratives → series_bible
- Présence de notes de production, budgets → production_notes
- Tableaux de personnages avec âges, rôles → character_sheet
- Contenu visuel, moodboard → moodboard_doc

ÉTAPE 2 — EXTRACTION D'ENTITÉS
Extrais TOUTES les informations structurées possibles. Sois EXHAUSTIF.
N'invente rien mais ne manque rien non plus.

Patterns français courants à détecter :
- "Patricia Ndongo, 29 ans, médecin" → character avec name, age, role
- "Clinique Ophélia" → location
- "SCÈNE 1 — INT. PARKING — NUIT" → scene avec location, time_of_day
- "MINI-ÉPISODE 1 : Titre" → episode
- "LOGLINE :" suivi de texte → logline
- "PITCH ÉTENDU" → synopsis
- Tableaux avec colonnes "Nom", "Âge", "Rôle" → multiple characters

Retourne un JSON avec :
{
  "document_role": "le_rôle_détecté",
  "role_confidence": 0.0-1.0,
  "parser_status": "success",
  "entities": [
    {
      "entity_type": "...",
      "entity_key": "identifiant court unique",
      "entity_value": { ... détails structurés ... },
      "source_passage": "passage exact du document (max 200 chars)",
      "extraction_confidence": 0.0-1.0
    }
  ]
}

Types d'entités : title, logline, synopsis, genre, tone, target_audience, format, duration, character, location, prop, costume, wardrobe, music, lyric, visual_reference, scene, dialogue_sample, theme, continuity_rule, legal_note, vfx_overlay, aspect_ratio, chronology, relationship, mood, cinematic_reference, cliffhanger, ambiance, camera_direction, lighting, color_palette, sound_design, transition, production_directive, sensory_note, emotional_arc.

Pour les personnages: name, age, role, personality, visual_description, relationships, backstory, arc, wardrobe, gender, recurring.
Pour les scènes: title, description, location, characters, mood, props, time_of_day, int_ext, camera_notes, lighting_notes.
Pour les lieux: name, description, mood, time_period, visual_atmosphere.
Pour la continuité: rule, scope, severity.
Pour les relations: character_a, character_b, type, evolution.
Pour camera_direction: shot_type, movement, framing, lens, description.
Pour lighting: type, mood, color_temperature, description.
Pour color_palette: colors, mood, reference.
Pour sound_design: type, description, mood, source.
Pour transition: type, from_scene, to_scene, description.
Pour production_directive: directive, priority, scope.
Pour sensory_note: sense, description, scene.

IMPORTANT: Si le document contient clairement des personnages, lieux, scènes — extrais-les TOUS. Ne retourne JAMAIS un tableau vide si le contenu est riche.
Si le document contient des directives de réalisation (caméra, lumière, couleur, son), extrais-les aussi — elles sont ESSENTIELLES pour le rendu final.`;

  if (projectType === "series") {
    return base + `

EXTRACTION SPÉCIFIQUE SÉRIES :
- Extrais la STRUCTURE COMPLÈTE : nombre de saisons, épisodes par saison, titres d'épisodes.
- Pour chaque épisode détecté, extrais : title, number, synopsis, scenes[], act_structure, cliffhanger_end.
- Identifie les personnages RÉCURRENTS vs INVITÉS.
- Extrais les RÈGLES DE CONTINUITÉ entre épisodes.
- Si "MINI-ÉPISODE" est utilisé, traite-le comme entity_type="episode".
- Identifie les dépendances de continuité entre épisodes.
- Extrais les DIRECTIVES DE RÉALISATION : cadrage, mouvements de caméra, style visuel, palette de couleurs, ambiances lumineuses.
- Extrais les indications SENSORIELLES : textures, odeurs, sons d'ambiance décrits dans le texte.
- Extrais le SOUND DESIGN mentionné : musique, bruitages, silences dramatiques.
- Identifie les TRANSITIONS entre scènes si décrites.

Types additionnels : episode, season_arc, continuity_dependency, recurring_element, episode_callback, camera_direction, lighting, color_palette, sound_design, transition, sensory_note, production_directive.`;
  }

  if (projectType === "film") {
    return base + `

EXTRACTION SPÉCIFIQUE FILM :
- Extrais la STRUCTURE EN ACTES : Acte 1 (setup), Acte 2 (confrontation), Acte 3 (résolution).
- Extrais la CHRONOLOGIE NARRATIVE.
- Identifie les MOTIFS VISUELS RÉCURRENTS.
- Extrais les ARCS DE PERSONNAGES.
- Identifie les SCÈNES CLÉ.

Types additionnels : act_structure, narrative_sequence, visual_motif, character_arc, prestige_shot, montage_note.`;
  }

  if (projectType === "music_video") {
    return base + `

EXTRACTION SPÉCIFIQUE CLIP MUSICAL :
- Extrais les PAROLES complètes si présentes.
- Extrais le CONCEPT VISUEL.
- Identifie les SECTIONS MUSICALES.
- Extrais le BPM et la TONALITÉ si mentionnés.

Types additionnels : lyric_section, music_section, performance_cue, beat_map, iconic_shot, section_mood, artist_lookdev.`;
  }

  return base + "\nSois exhaustif mais précis. N'invente rien.";
}

// ═══════════════════════════════════════════════════
// AI BATCH HELPER — parallel-safe
// ═══════════════════════════════════════════════════

async function callAIBatch(
  apiKey: string,
  fileName: string,
  text: string,
  batchIdx: number,
  totalBatches: number,
  projectType: string,
  isContinuation: boolean,
): Promise<{ entities: Array<Record<string, unknown>>; role?: string; roleConfidence?: number } | null> {
  try {
    const batchPrompt = isContinuation
      ? `Ceci est la PARTIE ${batchIdx + 1}/${totalBatches} du même document "${fileName}".
Continue l'extraction d'entités. N'inclus PAS les entités déjà extraites dans les parties précédentes.
Ne re-classifie PAS le document (garde le même rôle).
Extrais uniquement les NOUVELLES entités de cette section.`
      : "";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: getWorkflowPrompt(projectType) },
          ...(batchPrompt ? [{ role: "system", content: batchPrompt }] : []),
          { role: "user", content: text },
        ],
        temperature: 0.15,
        response_format: { type: "json_object" },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content || "{}";
      const parsed = JSON.parse(rawContent);
      return {
        entities: parsed.entities || [],
        role: parsed.document_role,
        roleConfidence: Number(parsed.role_confidence) || 0,
      };
    } else {
      const errBody = await response.text();
      console.error(`AI extraction batch ${batchIdx + 1} error:`, response.status, errBody);
      return null;
    }
  } catch (e: any) {
    console.error(`AI extraction batch ${batchIdx + 1} error:`, e?.message || e);
    return null;
  }
}

// ═══════════════════════════════════════════════════
// PROCESS DOCUMENT (core pipeline)
// ═══════════════════════════════════════════════════

async function processDocument(
  supabase: any,
  documentId: string,
  userId: string
): Promise<Response> {
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  const { data: doc, error: docErr } = await supabase
    .from("source_documents")
    .select("*")
    .eq("id", documentId)
    .single();
  if (docErr || !doc) throw new Error("Document not found");

  await supabase.from("source_documents").update({ status: "extracting" }).eq("id", documentId);

  // For images — classify role and store as entity
  if (doc.file_type === "image") {
    await supabase.from("source_documents").update({
      status: "ready_for_review",
      document_role: "reference_images",
      role_confidence: 0.85,
    }).eq("id", documentId);

    await supabase.from("source_document_entities").insert({
      document_id: documentId,
      entity_type: "visual_reference",
      entity_key: doc.file_name,
      entity_value: { type: "image", storage_path: doc.storage_path, file_name: doc.file_name },
      extraction_confidence: 0.9,
      status: "confirmed",
    });

    return new Response(JSON.stringify({
      entities_found: 1, auto_filled: 1, needs_review: 0,
      document_role: "reference_images", role_confidence: 0.85,
      parser_status: "success", extraction_method: "image_classify",
      text_length: 0,
    }), { headers });
  }

  // ─── Download and extract text using proper type-safe extractors ───
  let textContent = "";
  let extractionMethod = "unknown";
  let parserSuccess = false;
  let parserDebug: Record<string, unknown> = {};

  try {
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("source-documents")
      .download(doc.storage_path);
    if (dlErr || !fileData) throw new Error("Cannot download file: " + (dlErr?.message || "no data"));

    const extraction = await extractTextFromFile(fileData, doc.file_type, doc.file_name);
    textContent = extraction.text;
    extractionMethod = extraction.method;
    parserSuccess = extraction.success;
    parserDebug = extraction.parserDebug || {};

    console.log(`Extraction complete for ${doc.file_name}: method=${extractionMethod} success=${parserSuccess} chars=${extraction.charCount}`);
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Unknown download error";
    console.error(`File extraction failed for ${doc.file_name}:`, errMsg);
    extractionMethod = PARSER_STATUS.DOWNLOAD_FAILED;
    parserSuccess = false;
    textContent = "";
    parserDebug = { downloadError: errMsg };
  }

  // Build comprehensive extraction_debug for storage
  const extractionDebug = {
    parser_version: PARSER_VERSION,
    parser_chosen: extractionMethod,
    parser_status: parserSuccess ? "succeeded" : "failed",
    parser_success: parserSuccess,
    file_type_detected: doc.file_type,
    file_name: doc.file_name,
    file_size_bytes: doc.file_size_bytes,
    extracted_text_length: textContent.length,
    text_preview: textContent.slice(0, 1000) || "(empty)",
    fallback_attempted: false,  // DOCX never falls back
    final_extraction_mode: extractionMethod,
    error_message: parserSuccess ? null : `Extraction échouée (${extractionMethod})`,
    parser_debug: parserDebug,
    timestamp: new Date().toISOString(),
  };

  // Emit diagnostic event: parser result
  try {
    await supabase.from("diagnostic_events").insert({
      project_id: doc.project_id || "00000000-0000-0000-0000-000000000000",
      scope: "ingestion",
      scope_id: documentId,
      event_type: parserSuccess ? "parser_completed" : "parser_failed",
      severity: parserSuccess ? "info" : "error",
      title: parserSuccess
        ? `Parser ${extractionMethod} réussi pour ${doc.file_name}`
        : `Parser ${extractionMethod} échoué pour ${doc.file_name}`,
      detail: parserSuccess
        ? `${textContent.length} caractères extraits via ${extractionMethod} (v${PARSER_VERSION})`
        : `Erreur: ${extractionDebug.error_message} | Parser: ${extractionMethod} | Version: ${PARSER_VERSION}`,
      raw_data: {
        parser_version: PARSER_VERSION,
        extraction_method: extractionMethod,
        text_length: textContent.length,
        file_type: doc.file_type,
        file_name: doc.file_name,
        duration_ms: null,
        fallback_used: false,
      },
    });
  } catch (diagErr) {
    console.warn("Failed to insert diagnostic event:", diagErr);
  }

  // If extraction failed, mark document and return honest failure — do NOT proceed to AI
  if (!parserSuccess || textContent.length < 20) {
    const currentRun = { ...extractionDebug, completed_at: new Date().toISOString() };
    await supabase.from("source_documents").update({
      status: "parsing_failed",
      extraction_mode: extractionMethod,
      parser_version: PARSER_VERSION,
      metadata: {
        ...(typeof doc.metadata === "object" && doc.metadata ? doc.metadata : {}),
        extraction_debug: extractionDebug,
        current_active_run: currentRun,
      },
    }).eq("id", documentId);

    // Create autofill run with failure
    await supabase.from("source_document_autofill_runs").insert({
      document_id: documentId,
      status: "failed",
      total_fields: 0,
      auto_filled: 0,
      needs_review: 0,
      rejected: 0,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({
      entities_found: 0, auto_filled: 0, needs_review: 0,
      document_role: "unknown", role_confidence: 0,
      parser_status: "failed",
      parser_error: extractionDebug.error_message,
      extraction_method: extractionMethod,
      extraction_debug: extractionDebug,
      text_length: textContent.length,
    }), { headers });
  }

  // Store structured chunks
  const chunks = splitIntoStructuredChunks(textContent, 3000);
  for (let i = 0; i < chunks.length; i++) {
    await supabase.from("source_document_chunks").insert({
      document_id: documentId,
      chunk_index: i,
      content: chunks[i].content,
      section_type: chunks[i].sectionType,
    });
  }

  const analyzingRun = { ...extractionDebug, chunk_count: chunks.length };
  await supabase.from("source_documents").update({
    status: "analyzing",
    extraction_mode: extractionMethod,
    metadata: {
      ...(typeof doc.metadata === "object" && doc.metadata ? doc.metadata : {}),
      extraction_debug: analyzingRun,
      current_active_run: analyzingRun,
    },
  }).eq("id", documentId);

  // Determine project type for workflow-specific prompts
  let projectType = "generic";
  if (doc.project_id) {
    const { data: project } = await supabase
      .from("projects")
      .select("type")
      .eq("id", doc.project_id)
      .single();
    if (project?.type) projectType = project.type;
  }

  // AI: classify document role + extract entities
  let entities: Array<Record<string, unknown>> = [];
  let detectedRole = "unknown";
  let roleConfidence = 0;
  let aiParserStatus = "skipped";

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (LOVABLE_API_KEY && textContent.length > 20) {
    const BATCH_SIZE = 50000; // chars per AI call (increased for fewer batches)
    const MAX_BATCHES = 4;
    const textBatches: string[] = [];
    
    // Split text into manageable batches for large documents
    if (textContent.length <= 80000) {
      // Single batch for most documents (increased threshold)
      textBatches.push(textContent);
    } else {
      for (let i = 0; i < Math.min(MAX_BATCHES, Math.ceil(textContent.length / BATCH_SIZE)); i++) {
        textBatches.push(textContent.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE));
      }
    }

    console.log(`AI extraction: ${textBatches.length} batch(es) for ${doc.file_name} (${textContent.length} chars)`);

    // Process first batch to get role classification
    const firstBatchResult = await callAIBatch(LOVABLE_API_KEY, doc.file_name, textBatches[0], 0, textBatches.length, projectType, false);
    if (firstBatchResult) {
      entities.push(...firstBatchResult.entities);
      detectedRole = firstBatchResult.role || "unknown";
      roleConfidence = firstBatchResult.roleConfidence || 0;
      aiParserStatus = "success";
      console.log(`AI batch 1/${textBatches.length} for ${doc.file_name}: entities=${firstBatchResult.entities.length}`);
    } else {
      aiParserStatus = "exception";
    }

    // Process remaining batches IN PARALLEL
    if (textBatches.length > 1) {
      const remainingPromises = textBatches.slice(1).map((text, i) =>
        callAIBatch(LOVABLE_API_KEY, doc.file_name, text, i + 1, textBatches.length, projectType, true)
      );
      const results = await Promise.all(remainingPromises);
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r) {
          entities.push(...r.entities);
          if (aiParserStatus !== "success") aiParserStatus = "success";
          console.log(`AI batch ${i + 2}/${textBatches.length} for ${doc.file_name}: entities=${r.entities.length} (total=${entities.length})`);
        }
      }
    }

    // For script documents: ensure proper role classification
    if (detectedRole === "unknown" && roleConfidence === 0) {
      const hasSceneMarkers = /SC[ÈE]NE\s*\d|INT\.|EXT\./i.test(textContent.slice(0, 10000));
      const hasEpisodeMarkers = /[ÉE]PISODE\s*\d|MINI-[ÉE]PISODE/i.test(textContent.slice(0, 10000));
      if (hasSceneMarkers) {
        detectedRole = hasEpisodeMarkers ? "episode_script" : "script_master";
        roleConfidence = 0.85;
      }
    }
  }

  // Update document with classified role
  await supabase.from("source_documents").update({
    document_role: detectedRole,
    role_confidence: roleConfidence,
  }).eq("id", documentId);

  // Deduplicate entities by entity_type + entity_key
  const entityKeySet = new Set<string>();
  const dedupedEntities: Array<Record<string, unknown>> = [];
  for (const entity of entities) {
    const key = `${entity.entity_type}::${entity.entity_key}`;
    if (!entityKeySet.has(key)) {
      entityKeySet.add(key);
      dedupedEntities.push(entity);
    }
  }
  entities = dedupedEntities;

  // Store entities
  for (const entity of entities) {
    await supabase.from("source_document_entities").insert({
      document_id: documentId,
      entity_type: entity.entity_type as string,
      entity_key: entity.entity_key as string || "unknown",
      entity_value: entity.entity_value || {},
      source_passage: entity.source_passage as string || null,
      extraction_confidence: Number(entity.extraction_confidence) || 0.5,
      mapping_confidence: estimateMappingConfidence(entity),
      semantic_confidence: Number(entity.extraction_confidence) || 0.5,
      ambiguity_flag: Number(entity.extraction_confidence) < 0.6,
      status: Number(entity.extraction_confidence) >= 0.8 ? "confirmed" : "proposed",
    });
  }

  // Generate field mappings
  const mappingCount = await generateMappings(supabase, documentId, doc.series_id, doc.project_id);

  // Build canonical fields for the project
  if (doc.project_id) {
    await buildCanonicalFields(supabase, doc.project_id, documentId);
  }

  // Create autofill run
  const autoFilled = entities.filter(e => Number(e.extraction_confidence) >= 0.8).length;
  const needsReview = entities.filter(e => Number(e.extraction_confidence) >= 0.5 && Number(e.extraction_confidence) < 0.8).length;

  await supabase.from("source_document_autofill_runs").insert({
    document_id: documentId,
    status: entities.length > 0 ? "completed" : "no_entities",
    total_fields: entities.length,
    auto_filled: autoFilled,
    needs_review: needsReview,
    rejected: 0,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });

  const finalRun = {
    ...extractionDebug,
    chunk_count: chunks.length,
    ai_parser_status: aiParserStatus,
    entities_extracted: entities.length,
    completed_at: new Date().toISOString(),
  };
  const existingMeta = (typeof doc.metadata === "object" && doc.metadata ? doc.metadata : {}) as Record<string, unknown>;
  const latestSuccessfulRun = {
    parser_version: PARSER_VERSION,
    entities_count: entities.length,
    text_length: textContent.length,
    chunks_count: chunks.length,
    ai_parser_status: aiParserStatus,
    completed_at: new Date().toISOString(),
  };
  await supabase.from("source_documents").update({
    status: "ready_for_review",
    parser_version: PARSER_VERSION,
    latest_successful_run: latestSuccessfulRun,
    metadata: {
      ...existingMeta,
      extraction_debug: finalRun,
      current_active_run: finalRun,
      // Preserve run_history from reprocess if present
      run_history: existingMeta.run_history || existingMeta.previous_runs || [],
    },
  }).eq("id", documentId);

  // Emit diagnostic event: extraction completed
  try {
    await supabase.from("diagnostic_events").insert({
      project_id: doc.project_id || "00000000-0000-0000-0000-000000000000",
      scope: "ingestion",
      scope_id: documentId,
      event_type: "extraction_completed",
      severity: entities.length > 0 ? "info" : "warning",
      title: `Extraction terminée pour ${doc.file_name}: ${entities.length} entités`,
      detail: `Rôle: ${detectedRole} (${Math.round(roleConfidence * 100)}%) | ${textContent.length} chars | ${chunks.length} chunks | AI: ${aiParserStatus} | v${PARSER_VERSION}`,
      raw_data: {
        parser_version: PARSER_VERSION,
        document_role: detectedRole,
        role_confidence: roleConfidence,
        entities_count: entities.length,
        auto_filled: autoFilled,
        needs_review: needsReview,
        text_length: textContent.length,
        chunks_count: chunks.length,
      },
    });
  } catch (diagErr) {
    console.warn("Failed to insert extraction diagnostic:", diagErr);
  }

  await supabase.from("audit_logs").insert({
    user_id: userId,
    action: "document_imported",
    entity_type: "source_document",
    entity_id: documentId,
    details: {
      file_name: doc.file_name,
      document_role: detectedRole,
      role_confidence: roleConfidence,
      entities_found: entities.length,
      auto_filled: autoFilled,
      needs_review: needsReview,
      mappings_created: mappingCount,
      project_type: projectType,
      extraction_method: extractionMethod,
      text_length: textContent.length,
      chunks_count: chunks.length,
      ai_parser_status: aiParserStatus,
      parser_version: PARSER_VERSION,
    },
  });

  return new Response(JSON.stringify({
    entities_found: entities.length,
    auto_filled: autoFilled,
    needs_review: needsReview,
    mappings_created: mappingCount,
    document_role: detectedRole,
    role_confidence: roleConfidence,
    status: "ready_for_review",
    parser_status: aiParserStatus === "success" ? "success" : (parserSuccess ? "partial" : "failed"),
    parser_version: PARSER_VERSION,
    extraction_method: extractionMethod,
    text_length: textContent.length,
    chunks_count: chunks.length,
    extraction_debug: finalRun,
  }), { headers });
}

// ═══════════════════════════════════════════════════
// CONTEXTUAL RETRIEVAL FOR GENERATION
// ═══════════════════════════════════════════════════

async function retrieveContext(
  supabase: any,
  body: {
    project_id: string;
    scope: "scene" | "episode" | "character" | "project" | "timeline" | "continuity";
    scope_id?: string;
    entity_types?: string[];
    max_tokens?: number;
  }
): Promise<Response> {
  const headers = { ...corsHeaders, "Content-Type": "application/json" };
  const { project_id, scope, scope_id, entity_types, max_tokens = 8000 } = body;

  let cfQuery = supabase
    .from("canonical_fields")
    .select("*")
    .eq("project_id", project_id)
    .eq("approved", true);
  if (entity_types?.length) cfQuery = cfQuery.in("entity_type", entity_types);
  const { data: canonicalFields } = await cfQuery;

  const { data: docs } = await supabase
    .from("source_documents")
    .select("id, document_role, source_priority")
    .eq("project_id", project_id)
    .neq("source_priority", "deprecated");
  const docIds = (docs || []).map((d: any) => d.id);

  let entQuery = supabase
    .from("source_document_entities")
    .select("*")
    .in("document_id", docIds.length > 0 ? docIds : ["none"])
    .gte("extraction_confidence", 0.6)
    .in("status", ["confirmed", "proposed"]);
  if (entity_types?.length) entQuery = entQuery.in("entity_type", entity_types);
  const { data: entities } = await entQuery;

  const context: Record<string, unknown> = {
    project_canon: {},
    entities: [],
    continuity_rules: [],
    style_references: [],
  };

  const canon: Record<string, Record<string, unknown>> = {};
  for (const f of canonicalFields || []) {
    if (!canon[f.entity_type]) canon[f.entity_type] = {};
    canon[f.entity_type][f.field_key] = f.canonical_value;
  }
  context.project_canon = canon;

  const relevantEntities = (entities || []).filter((e: any) => {
    if (scope === "project") return true;
    if (scope === "character" && ["character", "relationship", "wardrobe", "costume", "character_arc", "emotional_arc"].includes(e.entity_type)) return true;
    if (scope === "scene" && ["scene", "location", "prop", "mood", "ambiance", "visual_reference", "continuity_rule", "camera_direction", "lighting", "color_palette", "sound_design", "transition", "sensory_note", "production_directive"].includes(e.entity_type)) return true;
    if (scope === "episode" && ["episode", "scene", "character", "continuity_rule", "cliffhanger", "season_arc", "camera_direction", "lighting", "sound_design", "transition", "production_directive"].includes(e.entity_type)) return true;
    if (scope === "timeline" && ["chronology", "scene", "episode", "music", "montage_note", "transition", "sound_design"].includes(e.entity_type)) return true;
    if (scope === "continuity" && ["continuity_rule", "character", "wardrobe", "prop", "location", "recurring_element", "color_palette", "sensory_note"].includes(e.entity_type)) return true;
    return false;
  });

  const docPriorityMap: Record<string, number> = {};
  for (const d of docs || []) {
    docPriorityMap[d.id] = PRIORITY_ORDER[d.source_priority || "supporting_reference"] || 3;
  }
  relevantEntities.sort((a: any, b: any) => {
    const pa = docPriorityMap[a.document_id] || 3;
    const pb = docPriorityMap[b.document_id] || 3;
    if (pa !== pb) return pb - pa;
    return b.extraction_confidence - a.extraction_confidence;
  });

  let tokenEstimate = JSON.stringify(context.project_canon).length / 4;
  const trimmedEntities: Array<Record<string, unknown>> = [];
  for (const e of relevantEntities) {
    const entSize = JSON.stringify(e.entity_value).length / 4;
    if (tokenEstimate + entSize > max_tokens) break;
    trimmedEntities.push({
      type: e.entity_type,
      key: e.entity_key,
      value: e.entity_value,
      confidence: e.extraction_confidence,
      source_passage: e.source_passage?.slice(0, 200),
    });
    tokenEstimate += entSize;
  }
  context.entities = trimmedEntities;

  const continuityRules = (entities || [])
    .filter((e: any) => e.entity_type === "continuity_rule")
    .map((e: any) => ({ rule: e.entity_value, key: e.entity_key, confidence: e.extraction_confidence }));
  context.continuity_rules = continuityRules;

  const styleEntities = (entities || [])
    .filter((e: any) => ["visual_reference", "mood", "ambiance", "cinematic_reference", "camera_direction", "lighting", "color_palette", "sensory_note"].includes(e.entity_type))
    .slice(0, 20)
    .map((e: any) => ({ type: e.entity_type, key: e.entity_key, value: e.entity_value }));
  context.style_references = styleEntities;

  // Production directives for render pipeline
  const productionDirectives = (entities || [])
    .filter((e: any) => ["production_directive", "camera_direction", "sound_design", "transition"].includes(e.entity_type))
    .slice(0, 15)
    .map((e: any) => ({ type: e.entity_type, key: e.entity_key, value: e.entity_value }));
  context.production_directives = productionDirectives;

  return new Response(JSON.stringify({
    scope,
    scope_id,
    context,
    entities_included: trimmedEntities.length,
    token_estimate: Math.round(tokenEstimate),
  }), { headers });
}

// ═══════════════════════════════════════════════════
// BATCH PROCESSING
// ═══════════════════════════════════════════════════

async function batchProcess(
  supabase: any,
  body: { project_id: string; document_ids: string[]; series_id?: string },
  userId: string
): Promise<Response> {
  const headers = { ...corsHeaders, "Content-Type": "application/json" };
  const { project_id, document_ids, series_id } = body;

  const { data: run, error: runErr } = await supabase.from("ingestion_runs").insert({
    project_id,
    series_id: series_id || null,
    status: "processing",
    documents_total: document_ids.length,
    started_at: new Date().toISOString(),
  }).select().single();
  if (runErr) throw runErr;

  let totalEntities = 0;
  let processed = 0;

  for (const docId of document_ids) {
    try {
      const result = await processDocument(supabase, docId, userId);
      const resultData = await result.json();
      totalEntities += resultData.entities_found || 0;
      processed++;
      await supabase.from("ingestion_runs").update({
        documents_processed: processed,
        entities_extracted: totalEntities,
      }).eq("id", run.id);
    } catch (e) {
      console.error(`Error processing doc ${docId}:`, e);
    }
  }

  let conflictsFound = 0;
  let missingFound = 0;
  try {
    const conflictResult = await detectConflicts(supabase, project_id, userId);
    const conflictData = await conflictResult.json();
    conflictsFound = conflictData.conflicts_found || 0;

    const missingResult = await detectMissingInfo(supabase, project_id, userId);
    const missingData = await missingResult.json();
    missingFound = missingData.missing_count || 0;
  } catch (e) {
    console.error("Post-batch analysis error:", e);
  }

  await supabase.from("ingestion_runs").update({
    status: "completed",
    documents_processed: processed,
    entities_extracted: totalEntities,
    conflicts_found: conflictsFound,
    missing_detected: missingFound,
    completed_at: new Date().toISOString(),
  }).eq("id", run.id);

  return new Response(JSON.stringify({
    run_id: run.id,
    documents_processed: processed,
    entities_extracted: totalEntities,
    conflicts_found: conflictsFound,
    missing_detected: missingFound,
  }), { headers });
}

// ═══════════════════════════════════════════════════
// CONFLICT DETECTION
// ═══════════════════════════════════════════════════

async function detectConflicts(
  supabase: any,
  projectId: string,
  _userId: string
): Promise<Response> {
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  const { data: docs } = await supabase
    .from("source_documents")
    .select("id, document_role, source_priority")
    .eq("project_id", projectId);
  if (!docs || docs.length < 2) {
    return new Response(JSON.stringify({ conflicts_found: 0 }), { headers });
  }

  const docIds = docs.map((d: any) => d.id);
  const { data: allEntities } = await supabase
    .from("source_document_entities")
    .select("*")
    .in("document_id", docIds);
  if (!allEntities) {
    return new Response(JSON.stringify({ conflicts_found: 0 }), { headers });
  }

  const groups: Record<string, typeof allEntities> = {};
  for (const e of allEntities) {
    const key = `${e.entity_type}::${e.entity_key.toLowerCase().trim()}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  }

  let conflictsFound = 0;
  for (const [groupKey, groupEntities] of Object.entries(groups)) {
    if (groupEntities.length < 2) continue;
    const uniqueDocs = [...new Set(groupEntities.map((e: any) => e.document_id))];
    if (uniqueDocs.length < 2) continue;
    const valueStrings = groupEntities.map((e: any) => JSON.stringify(e.entity_value));
    const uniqueValues = [...new Set(valueStrings)];
    if (uniqueValues.length < 2) continue;

    const [entityType, entityKey] = groupKey.split("::");
    const first = groupEntities[0];
    const second = groupEntities.find((e: any) => JSON.stringify(e.entity_value) !== JSON.stringify(first.entity_value));
    if (!second) continue;

    const { data: existing } = await supabase
      .from("canonical_conflicts")
      .select("id")
      .eq("project_id", projectId)
      .eq("field_key", entityKey)
      .eq("entity_type", entityType)
      .limit(1);
    if (existing && existing.length > 0) continue;

    const severity = ["character", "episode", "continuity_rule", "continuity_dependency"].includes(entityType)
      ? "high" : "medium";

    await supabase.from("canonical_conflicts").insert({
      project_id: projectId,
      field_key: entityKey,
      entity_type: entityType,
      doc_a_id: first.document_id,
      doc_b_id: second.document_id,
      value_a: first.entity_value,
      value_b: second.entity_value,
      severity,
    });
    conflictsFound++;
  }

  return new Response(JSON.stringify({ conflicts_found: conflictsFound }), { headers });
}

// ═══════════════════════════════════════════════════
// MISSING INFO DETECTION
// ═══════════════════════════════════════════════════

async function detectMissingInfo(
  supabase: any,
  projectId: string,
  _userId: string
): Promise<Response> {
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  const { data: project } = await supabase
    .from("projects")
    .select("type, synopsis, title")
    .eq("id", projectId)
    .single();
  if (!project) return new Response(JSON.stringify({ missing_count: 0 }), { headers });

  const { data: canonicalFields } = await supabase
    .from("canonical_fields")
    .select("field_key, entity_type")
    .eq("project_id", projectId);
  const existingKeys = new Set((canonicalFields || []).map((f: any) => `${f.entity_type}::${f.field_key}`));

  const { data: docs } = await supabase
    .from("source_documents")
    .select("id")
    .eq("project_id", projectId);
  const docIds = (docs || []).map((d: any) => d.id);
  const { data: entities } = await supabase
    .from("source_document_entities")
    .select("entity_type")
    .in("document_id", docIds.length > 0 ? docIds : ["none"]);
  const extractedTypes = new Set((entities || []).map((e: any) => e.entity_type));

  const baseRequired = ["title", "synopsis", "character", "scene", "location", "mood"];
  const typeSpecific: Record<string, string[]> = {
    series: ["episode", "season_arc", "continuity_rule"],
    film: ["chronology", "act_structure", "character_arc"],
    music_video: ["music", "lyric", "beat_map", "performance_cue"],
  };

  const required = [...baseRequired, ...(typeSpecific[project.type] || [])];
  const missing: string[] = [];

  for (const field of required) {
    if (!extractedTypes.has(field) && !existingKeys.has(`project::${field}`)) {
      missing.push(field);
    }
  }

  let inferredCount = 0;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  const existingContext: Record<string, unknown>[] = [];
  if (LOVABLE_API_KEY && missing.length > 0 && docIds.length > 0) {
    const { data: allEntities } = await supabase
      .from("source_document_entities")
      .select("entity_type, entity_key, entity_value")
      .in("document_id", docIds)
      .gte("extraction_confidence", 0.5)
      .limit(50);
    if (allEntities) {
      for (const e of allEntities) {
        existingContext.push({ type: e.entity_type, key: e.entity_key, value: e.entity_value });
      }
    }
  }

  for (const field of missing) {
    const { data: existing } = await supabase
      .from("inferred_completions")
      .select("id")
      .eq("project_id", projectId)
      .eq("field_key", field)
      .eq("status", "proposed")
      .limit(1);
    if (existing && existing.length > 0) continue;

    let inferredValue: Record<string, unknown> = { note: `Information manquante: ${field}` };
    let confidence = 0;
    let sourceContext = `Détecté comme manquant pour un projet de type "${project.type}"`;

    if (LOVABLE_API_KEY && existingContext.length > 3) {
      try {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: `Tu es un assistant de production audiovisuelle. On te donne le contexte d'un projet et un champ manquant. Propose une valeur cohérente inférée du contexte existant. Retourne un JSON: { "inferred_value": { ... }, "confidence": 0.0-1.0, "reasoning": "..." }`,
              },
              {
                role: "user",
                content: `Projet type: ${project.type}\nTitre: ${project.title || "inconnu"}\n\nContexte existant:\n${JSON.stringify(existingContext.slice(0, 20), null, 1)}\n\nChamp manquant: ${field}\n\nPropose une valeur cohérente.`,
              },
            ],
            temperature: 0.3,
            response_format: { type: "json_object" },
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
          if (parsed.inferred_value) {
            inferredValue = parsed.inferred_value;
            confidence = Math.min(Number(parsed.confidence) || 0.3, 0.7);
            sourceContext = parsed.reasoning || sourceContext;
          }
        }
      } catch (e) {
        console.error("Inference error for", field, e);
      }
    }

    await supabase.from("inferred_completions").insert({
      project_id: projectId,
      field_key: field,
      entity_type: "project",
      inferred_value: inferredValue,
      source_context: sourceContext,
      confidence,
      status: "proposed",
      source_document_ids: docIds.slice(0, 5),
    });
    inferredCount++;
  }

  return new Response(JSON.stringify({
    missing_count: missing.length,
    missing_fields: missing,
    inferred_proposed: inferredCount,
  }), { headers });
}

// ═══════════════════════════════════════════════════
// BUILD CANONICAL FIELDS
// ═══════════════════════════════════════════════════

async function buildCanonicalFields(
  supabase: any,
  projectId: string,
  documentId: string
) {
  const { data: doc } = await supabase
    .from("source_documents")
    .select("source_priority")
    .eq("id", documentId)
    .single();
  const docPriority = PRIORITY_ORDER[doc?.source_priority || "supporting_reference"] || 3;

  const { data: entities } = await supabase
    .from("source_document_entities")
    .select("*")
    .eq("document_id", documentId)
    .gte("extraction_confidence", 0.6);
  if (!entities) return;

  for (const entity of entities) {
    const fieldKey = entity.entity_key;
    const entityType = entity.entity_type;

    const { data: existing } = await supabase
      .from("canonical_fields")
      .select("id, confidence, source_document_id")
      .eq("project_id", projectId)
      .eq("field_key", fieldKey)
      .eq("entity_type", entityType)
      .limit(1);

    if (existing && existing.length > 0) {
      const currentDoc = await supabase
        .from("source_documents")
        .select("source_priority")
        .eq("id", existing[0].source_document_id)
        .single();
      const currentPriority = PRIORITY_ORDER[currentDoc.data?.source_priority || "supporting_reference"] || 3;

      if (docPriority > currentPriority || entity.extraction_confidence > existing[0].confidence) {
        await supabase.from("canonical_fields").update({
          canonical_value: entity.entity_value,
          source_document_id: documentId,
          source_passage: entity.source_passage,
          confidence: entity.extraction_confidence,
        }).eq("id", existing[0].id);
      }
    } else {
      await supabase.from("canonical_fields").insert({
        project_id: projectId,
        field_key: fieldKey,
        entity_type: entityType,
        entity_name: entity.entity_key,
        canonical_value: entity.entity_value,
        source_document_id: documentId,
        source_passage: entity.source_passage,
        confidence: entity.extraction_confidence,
        approved: entity.extraction_confidence >= 0.85,
      });
    }
  }
}

// ═══════════════════════════════════════════════════
// WIZARD EXTRACT (pre-project)
// ═══════════════════════════════════════════════════

async function wizardExtract(
  supabase: any,
  body: { document_ids: string[]; project_type: string },
  userId: string
): Promise<Response> {
  const headers = { ...corsHeaders, "Content-Type": "application/json" };
  const { document_ids, project_type } = body;

  if (!document_ids?.length) {
    return new Response(JSON.stringify({ error: "document_ids required" }), { status: 400, headers });
  }

  // Process each document that hasn't been processed yet
  for (const docId of document_ids) {
    const { data: doc } = await supabase
      .from("source_documents")
      .select("status")
      .eq("id", docId)
      .single();
    if (doc?.status === "ready_for_review" || doc?.status === "reviewed" || doc?.status === "applied") continue;
    await processDocumentWithType(supabase, docId, userId, project_type);
  }

  // Gather all extracted entities across all documents
  const { data: allEntities } = await supabase
    .from("source_document_entities")
    .select("*, document:source_documents!inner(file_name, document_role, role_confidence)")
    .in("document_id", document_ids)
    .gte("extraction_confidence", 0.4)
    .order("extraction_confidence", { ascending: false });

  // Get document metadata for parser status
  const { data: docMeta } = await supabase
    .from("source_documents")
    .select("id, file_name, document_role, role_confidence, file_type, status, extraction_mode")
    .in("id", document_ids);

  // Build structured wizard prefill
  const prefill: Record<string, unknown> = {
    title: null,
    synopsis: null,
    genre: null,
    tone: null,
    characters: [],
    episodes: [],
    locations: [],
    scenes: 0,
    totalEntities: allEntities?.length || 0,
    conflicts: 0,
    missingFields: [],
  };

  const extractedFields: Array<{
    key: string;
    label: string;
    value: string;
    confidence: number;
    sourceDoc: string;
    multiline: boolean;
  }> = [];

  for (const e of allEntities || []) {
    const docName = (e as Record<string, unknown> & { document: { file_name: string } }).document?.file_name || "Document";
    const val = e.entity_value as Record<string, unknown>;

    switch (e.entity_type) {
      case "title":
        if (!prefill.title || e.extraction_confidence > 0.7) {
          prefill.title = val.value || e.entity_key;
          extractedFields.push({
            key: "title", label: "Titre",
            value: String(val.value || e.entity_key),
            confidence: e.extraction_confidence, sourceDoc: docName, multiline: false,
          });
        }
        break;
      case "logline":
      case "synopsis":
        if (!prefill.synopsis || e.extraction_confidence > 0.7) {
          prefill.synopsis = val.value || e.entity_key;
          extractedFields.push({
            key: "synopsis",
            label: e.entity_type === "logline" ? "Logline" : "Synopsis",
            value: String(val.value || e.entity_key),
            confidence: e.extraction_confidence, sourceDoc: docName, multiline: true,
          });
        }
        break;
      case "genre":
        prefill.genre = val.value || e.entity_key;
        extractedFields.push({
          key: "genre", label: "Genre",
          value: String(val.value || e.entity_key),
          confidence: e.extraction_confidence, sourceDoc: docName, multiline: false,
        });
        break;
      case "tone":
        prefill.tone = val.value || e.entity_key;
        extractedFields.push({
          key: "tone", label: "Ton / Ambiance",
          value: String(val.value || e.entity_key),
          confidence: e.extraction_confidence, sourceDoc: docName, multiline: false,
        });
        break;
      case "character":
        (prefill.characters as Array<Record<string, unknown>>).push({
          name: val.name || e.entity_key,
          role: val.role || null,
          age: val.age || null,
          confidence: e.extraction_confidence,
          sourceDoc: docName,
        });
        break;
      case "episode":
        (prefill.episodes as Array<Record<string, unknown>>).push({
          title: val.title || e.entity_key,
          number: val.number || null,
          synopsis: val.synopsis || null,
          confidence: e.extraction_confidence,
        });
        break;
      case "location":
        (prefill.locations as string[]).push(String(val.name || val.value || e.entity_key));
        break;
      case "scene":
        prefill.scenes = (prefill.scenes as number) + 1;
        break;
    }
  }

  // Detect missing fields based on project type — but only truly missing ones
  const baseRequired = ["title", "synopsis"];
  const typeSpecific: Record<string, string[]> = {
    series: ["character", "episode"],
    film: ["character", "scene"],
    music_video: ["tone"],
    hybrid_video: [],
  };
  const required = [...baseRequired, ...(typeSpecific[project_type] || [])];
  const extractedTypes = new Set((allEntities || []).map((e: any) => e.entity_type));
  const missingLabels: Record<string, string> = {
    title: "Titre du projet",
    synopsis: "Synopsis / Brief",
    character: "Personnages principaux",
    episode: "Structure des épisodes",
    scene: "Scènes",
    tone: "Ton / Ambiance",
  };

  // Only declare missing if extraction actually ran successfully on at least one doc
  const anyDocProcessed = (docMeta || []).some((d: any) =>
    d.status === "ready_for_review" || d.status === "reviewed" || d.status === "applied"
  );
  if (anyDocProcessed) {
    prefill.missingFields = required
      .filter(f => !extractedTypes.has(f))
      .map(f => missingLabels[f] || f);
  } else {
    prefill.missingFields = ["Analyse en cours…"];
  }

  // Include parser diagnostics per document — with text length and debug info
  const documentDiagnostics = (docMeta || []).map((d: any) => {
    const meta = d.metadata as Record<string, unknown> | null;
    const debug = meta?.extraction_debug as Record<string, unknown> | undefined;
    return {
      id: d.id,
      fileName: d.file_name,
      role: d.document_role,
      roleConfidence: d.role_confidence,
      fileType: d.file_type,
      extractionMode: d.extraction_mode,
      status: d.status,
      entitiesCount: (allEntities || []).filter((e: any) => e.document_id === d.id).length,
      textLength: debug?.extracted_text_length ?? 0,
      textPreview: debug?.text_preview ?? "",
      parserError: debug?.error_message ?? null,
      parserDebug: debug?.parser_debug ?? null,
    };
  });

  return new Response(JSON.stringify({
    prefill,
    extractedFields,
    documents: docMeta || [],
    documentsProcessed: document_ids.length,
    diagnostics: documentDiagnostics,
  }), { headers });
}

// Process a document with an explicit project type (no project_id needed)
async function processDocumentWithType(
  supabase: any,
  documentId: string,
  userId: string,
  projectType: string
): Promise<void> {
  const { data: doc, error: docErr } = await supabase
    .from("source_documents")
    .select("*")
    .eq("id", documentId)
    .single();
  if (docErr || !doc) throw new Error("Document not found");

  await supabase.from("source_documents").update({ status: "extracting" }).eq("id", documentId);

  // Images: quick classify
  if (doc.file_type === "image") {
    await supabase.from("source_documents").update({
      status: "ready_for_review",
      document_role: "reference_images",
      role_confidence: 0.85,
    }).eq("id", documentId);
    await supabase.from("source_document_entities").insert({
      document_id: documentId,
      entity_type: "visual_reference",
      entity_key: doc.file_name,
      entity_value: { type: "image", storage_path: doc.storage_path, file_name: doc.file_name },
      extraction_confidence: 0.9,
      status: "confirmed",
    });
    return;
  }

  // ─── Download and extract text using proper type-safe extractors ───
  let textContent = "";
  let extractionMethod = "unknown";
  let parserSuccess = false;
  let parserDebug: Record<string, unknown> = {};

  try {
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("source-documents")
      .download(doc.storage_path);
    if (dlErr || !fileData) throw new Error("Cannot download file: " + (dlErr?.message || "no data"));

    const extraction = await extractTextFromFile(fileData, doc.file_type, doc.file_name);
    textContent = extraction.text;
    extractionMethod = extraction.method;
    parserSuccess = extraction.success;
    parserDebug = extraction.parserDebug || {};

    console.log(`WizardExtraction for ${doc.file_name}: method=${extractionMethod} success=${parserSuccess} chars=${extraction.charCount}`);
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Unknown download error";
    console.error(`File extraction failed for ${doc.file_name}:`, errMsg);
    extractionMethod = PARSER_STATUS.DOWNLOAD_FAILED;
    parserSuccess = false;
    parserDebug = { downloadError: errMsg };
  }

  // If extraction failed, mark honestly and stop — do NOT proceed to AI
  if (!parserSuccess || textContent.length < 20) {
    await supabase.from("source_documents").update({
      status: "parsing_failed",
      extraction_mode: extractionMethod,
      metadata: {
        ...(typeof doc.metadata === "object" && doc.metadata ? doc.metadata : {}),
        extraction_debug: {
          parser_version: PARSER_VERSION,
          parser_chosen: extractionMethod,
          parser_status: "failed",
          parser_success: false,
          file_type_detected: doc.file_type,
          extracted_text_length: textContent.length,
          text_preview: textContent.slice(0, 1000) || "(empty)",
          fallback_attempted: false,
          final_extraction_mode: extractionMethod,
          error_message: `Extraction échouée (${extractionMethod})`,
          parser_debug: parserDebug,
          timestamp: new Date().toISOString(),
        },
      },
    }).eq("id", documentId);
    return;
  }

  // Store chunks
  const chunks = splitIntoStructuredChunks(textContent, 3000);
  for (let i = 0; i < chunks.length; i++) {
    await supabase.from("source_document_chunks").insert({
      document_id: documentId,
      chunk_index: i,
      content: chunks[i].content,
      section_type: chunks[i].sectionType,
    });
  }

  await supabase.from("source_documents").update({
    status: "analyzing",
    extraction_mode: extractionMethod,
  }).eq("id", documentId);

  // AI extraction with project-type-specific prompt
  let entities: Array<Record<string, unknown>> = [];
  let detectedRole = "unknown";
  let roleConfidence = 0;

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (LOVABLE_API_KEY && textContent.length > 20) {
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: getWorkflowPrompt(projectType) },
            { role: "user", content: textContent.slice(0, 60000) },
          ],
          temperature: 0.15,
          response_format: { type: "json_object" },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
        entities = parsed.entities || [];
        detectedRole = parsed.document_role || "unknown";
        roleConfidence = Number(parsed.role_confidence) || 0;
      }
    } catch (e) {
      console.error("AI extraction error:", e);
    }
  }

  await supabase.from("source_documents").update({
    document_role: detectedRole,
    role_confidence: roleConfidence,
  }).eq("id", documentId);

  // Store entities
  for (const entity of entities) {
    await supabase.from("source_document_entities").insert({
      document_id: documentId,
      entity_type: entity.entity_type as string,
      entity_key: entity.entity_key as string || "unknown",
      entity_value: entity.entity_value || {},
      source_passage: entity.source_passage as string || null,
      extraction_confidence: Number(entity.extraction_confidence) || 0.5,
      mapping_confidence: estimateMappingConfidence(entity),
      semantic_confidence: Number(entity.extraction_confidence) || 0.5,
      ambiguity_flag: Number(entity.extraction_confidence) < 0.6,
      status: Number(entity.extraction_confidence) >= 0.8 ? "confirmed" : "proposed",
    });
  }

  await supabase.from("source_documents").update({ status: "ready_for_review" }).eq("id", documentId);

  await supabase.from("audit_logs").insert({
    user_id: userId,
    action: "wizard_document_processed",
    entity_type: "source_document",
    entity_id: documentId,
    details: {
      file_name: doc.file_name,
      document_role: detectedRole,
      entities_found: entities.length,
      project_type: projectType,
      extraction_method: extractionMethod,
      text_length: textContent.length,
    },
  });
}

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

function estimateMappingConfidence(entity: Record<string, unknown>): number {
  const directTypes = ["title", "logline", "synopsis", "genre", "tone", "target_audience"];
  if (directTypes.includes(entity.entity_type as string)) return 0.9;
  if (entity.entity_type === "character") return 0.8;
  if (entity.entity_type === "episode") return 0.75;
  if (["act_structure", "season_arc", "beat_map"].includes(entity.entity_type as string)) return 0.7;
  return 0.6;
}

async function generateMappings(
  supabase: any,
  documentId: string,
  seriesId: string | null,
  projectId: string | null
): Promise<number> {
  const { data: entities } = await supabase
    .from("source_document_entities")
    .select("*")
    .eq("document_id", documentId);
  if (!entities) return 0;

  let count = 0;
  for (const entity of entities) {
    const mappings = getTargetMappings(entity.entity_type, entity.entity_key, entity.entity_value);
    for (const mapping of mappings) {
      await supabase.from("source_document_mappings").insert({
        entity_id: entity.id,
        target_table: mapping.table,
        target_field: mapping.field,
        proposed_value: mapping.value,
        status: entity.extraction_confidence >= 0.8 ? "auto_approved" : "proposed",
      });
      count++;
    }
  }
  return count;
}

// ═══════════════════════════════════════════════════
// REPROCESS DOCUMENT — clear old results and re-run pipeline
// ═══════════════════════════════════════════════════

async function reprocessDocument(
  supabase: any,
  documentId: string,
  userId: string
): Promise<Response> {
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  const { data: doc, error: docErr } = await supabase
    .from("source_documents")
    .select("*")
    .eq("id", documentId)
    .single();
  if (docErr || !doc) {
    return new Response(JSON.stringify({ error: "Document not found" }), { status: 404, headers });
  }

  // Verify storage_path exists — cannot reprocess without stored file
  if (!doc.storage_path) {
    return new Response(JSON.stringify({
      error: "No stored file found. Please re-upload this document.",
      reprocess_possible: false,
    }), { status: 400, headers });
  }

  // Archive old extraction results into run_history (not as active truth)
  const oldMeta = (typeof doc.metadata === "object" && doc.metadata ? doc.metadata : {}) as Record<string, unknown>;
  const runHistory = (oldMeta.run_history || oldMeta.previous_runs || []) as Array<Record<string, unknown>>;
  const oldDebug = oldMeta.extraction_debug || oldMeta.current_active_run;
  if (oldDebug) {
    runHistory.push({
      ...(oldDebug as Record<string, unknown>),
      archived_at: new Date().toISOString(),
      old_status: doc.status,
      old_extraction_mode: doc.extraction_mode,
      old_version: doc.version,
      parser_version: (oldDebug as Record<string, unknown>).parser_version || "legacy",
    });
  }

  // Clear old extraction data: entities, chunks, mappings (cascade), autofill runs
  await supabase.from("source_document_entities").delete().eq("document_id", documentId);
  await supabase.from("source_document_chunks").delete().eq("document_id", documentId);
  await supabase.from("source_document_autofill_runs").delete().eq("document_id", documentId);

  // Clear canonical fields sourced from this document
  if (doc.project_id) {
    await supabase.from("canonical_fields").delete()
      .eq("project_id", doc.project_id)
      .eq("source_document_id", documentId);
  }

  // Increment version, set status to reprocessing, clear stale state
  const newVersion = (doc.version || 1) + 1;
  await supabase.from("source_documents").update({
    version: newVersion,
    status: "reprocessing",
    extraction_mode: null,
    metadata: {
      ...oldMeta,
      run_history: runHistory,
      previous_runs: runHistory, // backward compat
      current_active_run: null,
      extraction_debug: null,
    },
  }).eq("id", documentId);

  // Log the reprocess action
  await supabase.from("audit_logs").insert({
    user_id: userId,
    action: "document_reprocessed",
    entity_type: "source_document",
    entity_id: documentId,
    details: {
      file_name: doc.file_name,
      old_version: doc.version,
      new_version: newVersion,
      old_extraction_mode: doc.extraction_mode,
      old_status: doc.status,
      reason: "legacy_parser_migration",
    },
  });

  // Re-run the full processing pipeline
  const result = await processDocument(supabase, documentId, userId);
  const resultData = await result.json();

  return new Response(JSON.stringify({
    reprocessed: true,
    document_id: documentId,
    new_version: newVersion,
    previous_runs_count: runHistory.length,
    parser_version: PARSER_VERSION,
    ...resultData,
  }), { headers });
}

// ═══════════════════════════════════════════════════
// REPROCESS LEGACY DOCUMENTS — bulk migration
// ═══════════════════════════════════════════════════

async function reprocessLegacyDocuments(
  supabase: any,
  body: { project_id?: string; series_id?: string; document_ids?: string[] },
  userId: string
): Promise<Response> {
  const headers = { ...corsHeaders, "Content-Type": "application/json" };
  const { project_id, series_id, document_ids } = body;

  // Find legacy documents
  let query = supabase.from("source_documents").select("*");
  if (document_ids?.length) {
    query = query.in("id", document_ids);
  } else if (project_id) {
    query = query.eq("project_id", project_id);
  } else if (series_id) {
    query = query.eq("series_id", series_id);
  } else {
    return new Response(JSON.stringify({ error: "project_id, series_id, or document_ids required" }), { status: 400, headers });
  }

  const { data: docs, error } = await query;
  if (error) throw error;

  // Filter to only legacy documents (skip already-current ones)
  const legacyDocs = (docs || []).filter((d: any) => isLegacyDocument(d as Record<string, unknown>));

  if (legacyDocs.length === 0) {
    return new Response(JSON.stringify({
      reprocessed: 0,
      skipped: (docs || []).length,
      message: "No legacy documents found — all documents use the current parser.",
    }), { headers });
  }

  let reprocessed = 0;
  let failed = 0;
  const results: Array<{ id: string; file_name: string; success: boolean; error?: string }> = [];

  for (const doc of legacyDocs) {
    try {
      const result = await reprocessDocument(supabase, doc.id, userId);
      const data = await result.json();
      const success = data.reprocessed === true;
      results.push({ id: doc.id, file_name: doc.file_name, success });
      if (success) reprocessed++;
      else failed++;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Unknown error";
      results.push({ id: doc.id, file_name: doc.file_name, success: false, error: errMsg });
      failed++;
    }
  }

  // Re-run conflict detection after bulk reprocess
  if (project_id && reprocessed > 0) {
    try {
      await detectConflicts(supabase, project_id, userId);
    } catch (e) {
      console.error("Post-reprocess conflict detection error:", e);
    }
  }

  return new Response(JSON.stringify({
    reprocessed,
    failed,
    skipped: (docs || []).length - legacyDocs.length,
    total_legacy: legacyDocs.length,
    results,
  }), { headers });
}

// ═══════════════════════════════════════════════════
// DEBUG DOCUMENT — isolated diagnostic tool
// ═══════════════════════════════════════════════════

async function debugDocument(
  supabase: any,
  documentId: string
): Promise<Response> {
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  if (!documentId) {
    return new Response(JSON.stringify({ error: "document_id required" }), { status: 400, headers });
  }

  const { data: doc, error: docErr } = await supabase
    .from("source_documents")
    .select("*")
    .eq("id", documentId)
    .single();
  if (docErr || !doc) {
    return new Response(JSON.stringify({ error: "Document not found" }), { status: 404, headers });
  }

  const result: Record<string, unknown> = {
    document_id: doc.id,
    file_name: doc.file_name,
    file_type: doc.file_type,
    file_size_bytes: doc.file_size_bytes,
    storage_path: doc.storage_path,
    current_status: doc.status,
    current_extraction_mode: doc.extraction_mode,
    current_metadata: doc.metadata,
  };

  // Skip extraction for images
  if (doc.file_type === "image") {
    result.diagnosis = "Image file — no text extraction applicable";
    return new Response(JSON.stringify(result), { headers });
  }

  // Download and run extraction
  try {
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("source-documents")
      .download(doc.storage_path);
    if (dlErr || !fileData) {
      result.download_error = dlErr?.message || "no data returned";
      result.diagnosis = "Cannot download file from storage";
      return new Response(JSON.stringify(result), { headers });
    }

    result.download_success = true;
    result.blob_size = fileData.size;
    result.blob_type = fileData.type;

    // Run extraction
    const extraction = await extractTextFromFile(fileData, doc.file_type, doc.file_name);
    result.extraction = {
      method: extraction.method,
      success: extraction.success,
      char_count: extraction.charCount,
      text_preview_500: extraction.text.slice(0, 500) || "(empty)",
      text_preview_1000: extraction.text.slice(0, 1000) || "(empty)",
      parser_debug: extraction.parserDebug || null,
    };

    // If extraction succeeded, also show chunking result
    if (extraction.success && extraction.text.length > 20) {
      const chunks = splitIntoStructuredChunks(extraction.text, 3000);
      result.chunking = {
        chunk_count: chunks.length,
        chunks: chunks.map((c, i) => ({
          index: i,
          section_type: c.sectionType,
          section_title: c.sectionTitle || null,
          content_length: c.content.length,
          content_preview: c.content.slice(0, 200),
        })),
      };
    }

    // Get existing entities count
    const { count: entityCount } = await supabase
      .from("source_document_entities")
      .select("id", { count: "exact", head: true })
      .eq("document_id", documentId);
    result.existing_entities_count = entityCount || 0;

    // Diagnosis
    if (extraction.success) {
      result.diagnosis = `Parser succeeded: ${extraction.charCount} chars extracted via ${extraction.method}`;
    } else {
      result.diagnosis = `Parser FAILED: ${extraction.method}. ${(extraction.parserDebug as Record<string, unknown>)?.error || "Unknown error"}`;
    }
  } catch (e) {
    result.exception = e instanceof Error ? e.message : String(e);
    result.diagnosis = "Exception during debug extraction";
  }

  return new Response(JSON.stringify(result), { headers });
}

function getTargetMappings(
  entityType: string,
  entityKey: string,
  entityValue: Record<string, unknown>
): Array<{ table: string; field: string; value: unknown }> {
  switch (entityType) {
    case "title": return [{ table: "projects", field: "title", value: entityValue.value || entityKey }];
    case "logline": return [{ table: "series", field: "logline", value: entityValue.value || entityKey }];
    case "synopsis": return [{ table: "projects", field: "synopsis", value: entityValue.value || entityKey }];
    case "genre": return [{ table: "series", field: "genre", value: entityValue.value || entityKey }];
    case "tone": return [{ table: "series", field: "tone", value: entityValue.value || entityKey }];
    case "target_audience": return [{ table: "series", field: "target_audience", value: entityValue.value || entityKey }];
    case "character": return [
      { table: "character_profiles", field: "name", value: entityValue.name || entityKey },
      ...(entityValue.visual_description ? [{ table: "character_profiles", field: "visual_description", value: entityValue.visual_description }] : []),
      ...(entityValue.personality ? [{ table: "character_profiles", field: "personality", value: entityValue.personality }] : []),
      ...(entityValue.backstory ? [{ table: "character_profiles", field: "backstory", value: entityValue.backstory }] : []),
      ...(entityValue.arc ? [{ table: "character_profiles", field: "arc", value: entityValue.arc }] : []),
      ...(entityValue.wardrobe ? [{ table: "character_profiles", field: "wardrobe", value: entityValue.wardrobe }] : []),
    ];
    case "episode": return [
      { table: "episodes", field: "title", value: entityValue.title || entityKey },
      ...(entityValue.synopsis ? [{ table: "episodes", field: "synopsis", value: entityValue.synopsis }] : []),
    ];
    case "location": return [{ table: "bibles", field: "content.locations", value: entityValue }];
    case "music": return [{ table: "bibles", field: "content.music", value: entityValue }];
    case "scene": return [{ table: "scenes", field: "description", value: entityValue }];
    case "continuity_rule": return [{ table: "continuity_conflicts", field: "description", value: entityValue }];
    case "wardrobe": case "costume": return [{ table: "character_profiles", field: "wardrobe", value: entityValue }];
    case "prop": return [{ table: "bibles", field: "content.props", value: entityValue }];
    case "mood": case "ambiance": return [{ table: "projects", field: "style_preset", value: entityValue }];
    case "act_structure": return [{ table: "bibles", field: "content.act_structure", value: entityValue }];
    case "season_arc": return [{ table: "bibles", field: "content.season_arc", value: entityValue }];
    case "beat_map": return [{ table: "audio_analysis", field: "beats_json", value: entityValue }];
    case "lyric_section": return [{ table: "bibles", field: "content.lyrics", value: entityValue }];
    case "performance_cue": return [{ table: "bibles", field: "content.performance_cues", value: entityValue }];
    default: return [];
  }
}

// ──────────────────────────────────────────────────────────────────────
// apply_corpus — Propagate all confirmed/proposed entities to target tables
// ──────────────────────────────────────────────────────────────────────

async function applyCorpus(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  userId: string
): Promise<Response> {
  const headers = { ...corsHeaders, "Content-Type": "application/json" };
  if (!projectId) return new Response(JSON.stringify({ error: "project_id required" }), { status: 400, headers });

  // Verify ownership
  const { data: project } = await supabase.from("projects").select("id, user_id, type").eq("id", projectId).single();
  if (!project || project.user_id !== userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers });
  }

  // Get series_id if project is a series
  let seriesId: string | null = null;
  if (project.type === "series") {
    const { data: ser } = await supabase.from("series").select("id").eq("project_id", projectId).single();
    seriesId = ser?.id || null;
  }

  // Load all project documents
  const { data: docs } = await supabase
    .from("source_documents").select("id").eq("project_id", projectId).neq("status", "parsing_failed");
  const docIds = (docs || []).map((d: any) => d.id);
  if (!docIds.length) return new Response(JSON.stringify({ applied: 0, message: "No documents found" }), { headers });

  // Load all confirmed/proposed entities
  const { data: entities } = await supabase
    .from("source_document_entities")
    .select("entity_type, entity_key, entity_value, extraction_confidence, document_id")
    .in("document_id", docIds)
    .in("status", ["confirmed", "proposed"])
    .gte("extraction_confidence", 0.4)
    .order("extraction_confidence", { ascending: false })
    .limit(500);

  if (!entities?.length) return new Response(JSON.stringify({ applied: 0, message: "No entities to apply" }), { headers });

  const stats = { episodes_updated: 0, characters_upserted: 0, scenes_inserted: 0, bibles_updated: 0, continuity_nodes: 0 };

  // ── Episodes: update matching episodes by number ──
  if (seriesId) {
    const { data: seasons } = await supabase.from("seasons").select("id").eq("series_id", seriesId);
    const seasonIds = (seasons || []).map((s: any) => s.id);
    if (seasonIds.length) {
      const { data: existingEpisodes } = await supabase.from("episodes").select("id, number, season_id").in("season_id", seasonIds);
      const epMap = new Map<number, string>();
      for (const ep of existingEpisodes || []) epMap.set(ep.number, ep.id);

      for (const ent of entities as any[]) {
        if (ent.entity_type !== "episode") continue;
        const val = typeof ent.entity_value === "string" ? JSON.parse(ent.entity_value) : ent.entity_value;
        const epNum = Number(val.number || val.episode_number || ent.entity_key?.match(/\d+/)?.[0]);
        const epId = epMap.get(epNum);
        if (!epId) continue;

        const update: Record<string, unknown> = {};
        if (val.title) update.title = val.title;
        if (val.synopsis) update.synopsis = val.synopsis;
        if (val.duration) update.duration_target_min = Number(val.duration);
        if (Object.keys(update).length) {
          await supabase.from("episodes").update(update).eq("id", epId);
          stats.episodes_updated++;
        }
      }
    }

    // ── Characters: upsert into character_profiles ──
    const { data: existingChars } = await supabase.from("character_profiles").select("id, name").eq("series_id", seriesId);
    const charMap = new Map<string, string>();
    for (const c of existingChars || []) charMap.set((c.name || "").toLowerCase(), c.id);

    for (const ent of entities as any[]) {
      if (ent.entity_type !== "character") continue;
      const val = typeof ent.entity_value === "string" ? JSON.parse(ent.entity_value) : ent.entity_value;
      const name = (val.name || ent.entity_key || "").trim();
      if (!name) continue;

      const existingId = charMap.get(name.toLowerCase());
      const fields: Record<string, unknown> = {};
      if (val.visual_description) fields.visual_description = val.visual_description;
      if (val.personality) fields.personality = val.personality;
      if (val.backstory) fields.backstory = val.backstory;
      if (val.arc) fields.arc = val.arc;
      if (val.wardrobe) fields.wardrobe = val.wardrobe;
      if (val.voice_notes) fields.voice_notes = val.voice_notes;
      if (val.relationships) fields.relationships = val.relationships;

      if (existingId) {
        if (Object.keys(fields).length) await supabase.from("character_profiles").update(fields).eq("id", existingId);
      } else {
        await supabase.from("character_profiles").insert({ series_id: seriesId, name, ...fields });
        charMap.set(name.toLowerCase(), "new");
      }
      stats.characters_upserted++;
    }

    // ── Scenes: insert into scenes table ──
    for (const ent of entities as any[]) {
      if (ent.entity_type !== "scene") continue;
      const val = typeof ent.entity_value === "string" ? JSON.parse(ent.entity_value) : ent.entity_value;
      const epNum = Number(val.episode_number || val.episode);
      const { data: seasons2 } = await supabase.from("seasons").select("id").eq("series_id", seriesId).limit(1);
      if (!seasons2?.length) continue;
      const { data: ep } = await supabase.from("episodes").select("id").eq("season_id", seasons2[0].id).eq("number", epNum).single();
      if (!ep) continue;

      await supabase.from("scenes").insert({
        episode_id: ep.id,
        idx: Number(val.scene_number || val.idx || 1),
        title: val.title || val.heading || ent.entity_key || "Scene",
        description: val.description || "",
        location: val.location || "",
        time_of_day: val.time_of_day || "",
        mood: val.mood || "",
        characters: val.characters || [],
        duration_target_sec: val.duration ? Number(val.duration) : null,
      });
      stats.scenes_inserted++;
    }

    // ── Continuity rules → continuity_memory_nodes ──
    for (const ent of entities as any[]) {
      if (ent.entity_type !== "continuity_rule") continue;
      const val = typeof ent.entity_value === "string" ? JSON.parse(ent.entity_value) : ent.entity_value;
      await supabase.from("continuity_memory_nodes").insert({
        series_id: seriesId,
        node_type: "rule",
        label: val.rule || val.description || ent.entity_key || "Continuity rule",
        properties: val,
        is_active: true,
      });
      stats.continuity_nodes++;
    }
  }

  // ── World data → bibles ──
  const worldTypes = ["location", "visual_reference", "prop", "act_structure", "season_arc", "mood"];
  const worldContent: Record<string, unknown[]> = {};
  let hasWorld = false;
  for (const ent of entities as any[]) {
    if (!worldTypes.includes(ent.entity_type)) continue;
    hasWorld = true;
    const val = typeof ent.entity_value === "string" ? JSON.parse(ent.entity_value) : ent.entity_value;
    const bucket = ent.entity_type === "visual_reference" || ent.entity_type === "mood" ? "visual_references" : ent.entity_type + "s";
    if (!worldContent[bucket]) worldContent[bucket] = [];
    worldContent[bucket].push({ key: ent.entity_key, ...val });
  }

  if (hasWorld && seriesId) {
    // Check if a world bible already exists
    const { data: existingBible } = await supabase.from("bibles").select("id, content").eq("series_id", seriesId).eq("type", "world").single();
    if (existingBible) {
      const merged = { ...(existingBible.content as Record<string, unknown>), ...worldContent };
      await supabase.from("bibles").update({ content: merged, version: (existingBible as any).version + 1 }).eq("id", existingBible.id);
    } else {
      await supabase.from("bibles").insert({ series_id: seriesId, name: "Bible Monde (corpus)", type: "world", content: worldContent, version: 1 });
    }
    stats.bibles_updated++;
  }

  // Audit log
  await supabase.from("audit_logs").insert({
    action: "corpus_applied",
    entity_type: "project",
    entity_id: projectId,
    user_id: userId,
    details: stats,
  }).catch(() => {});

  return new Response(JSON.stringify({ applied: true, stats }), { headers });
}

// ──────────────────────────────────────────────────────────────────────
// project_brain_summary — Complete knowledge coverage report
// ──────────────────────────────────────────────────────────────────────

async function projectBrainSummary(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  userId: string
): Promise<Response> {
  const headers = { ...corsHeaders, "Content-Type": "application/json" };
  if (!projectId) return new Response(JSON.stringify({ error: "project_id required" }), { status: 400, headers });

  const { data: project } = await supabase.from("projects").select("id, user_id, title, type, status, governance_state, quality_tier").eq("id", projectId).single();
  if (!project || project.user_id !== userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers });
  }

  // Documents
  const { data: docs, count: docCount } = await supabase.from("source_documents").select("id, status, document_role, file_name", { count: "exact" }).eq("project_id", projectId);
  const docsByRole: Record<string, number> = {};
  for (const d of docs || []) docsByRole[d.document_role || "unknown"] = (docsByRole[d.document_role || "unknown"] || 0) + 1;

  // Entities
  const docIds = (docs || []).map((d: any) => d.id);
  let entityStats: Record<string, number> = {};
  if (docIds.length) {
    const { data: ents } = await supabase.from("source_document_entities").select("entity_type").in("document_id", docIds).in("status", ["confirmed", "proposed"]);
    for (const e of ents || []) entityStats[e.entity_type] = (entityStats[e.entity_type] || 0) + 1;
  }

  // Canonical fields
  const { count: canonCount } = await supabase.from("canonical_fields").select("id", { count: "exact", head: true }).eq("project_id", projectId);

  // Series data
  let seriesData: Record<string, unknown> | null = null;
  if (project.type === "series") {
    const { data: ser } = await supabase.from("series").select("id, logline, genre, tone, total_seasons, episode_duration_min, episodes_per_season").eq("project_id", projectId).single();
    if (ser) {
      const { data: seasons } = await supabase.from("seasons").select("id").eq("series_id", ser.id);
      const seasonIds = (seasons || []).map((s: any) => s.id);

      // Episodes
      let episodesFilled = 0;
      let episodesTotal = 0;
      if (seasonIds.length) {
        const { data: episodes } = await supabase.from("episodes").select("id, title, synopsis, status").in("season_id", seasonIds);
        episodesTotal = episodes?.length || 0;
        episodesFilled = (episodes || []).filter((e: any) => e.synopsis && e.synopsis.length > 5).length;
      }

      // Characters
      const { count: charCount } = await supabase.from("character_profiles").select("id", { count: "exact", head: true }).eq("series_id", ser.id);

      // Bibles
      const { data: bibles } = await supabase.from("bibles").select("type, name").eq("series_id", ser.id);

      // Continuity nodes
      const { count: contNodes } = await supabase.from("continuity_memory_nodes").select("id", { count: "exact", head: true }).eq("series_id", ser.id);

      seriesData = {
        ...ser,
        episodes_total: episodesTotal,
        episodes_with_synopsis: episodesFilled,
        episode_coverage_pct: episodesTotal > 0 ? Math.round((episodesFilled / episodesTotal) * 100) : 0,
        character_count: charCount || 0,
        bible_count: bibles?.length || 0,
        bibles: bibles?.map((b: any) => ({ type: b.type, name: b.name })),
        continuity_nodes: contNodes || 0,
      };
    }
  }

  // Conflicts
  const { count: conflictCount } = await supabase.from("canonical_conflicts").select("id", { count: "exact", head: true }).eq("project_id", projectId).is("resolution", null);

  // Compute overall coverage score
  const checks = [
    docCount && docCount > 0,
    Object.keys(entityStats).length >= 3,
    (canonCount || 0) > 0,
    seriesData && (seriesData as any).episodes_with_synopsis > 0,
    seriesData && (seriesData as any).character_count > 0,
    seriesData && (seriesData as any).bible_count > 0,
    (conflictCount || 0) === 0,
  ];
  const coveragePct = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  return new Response(JSON.stringify({
    project: { id: project.id, title: project.title, type: project.type, status: project.status, governance_state: project.governance_state },
    documents: { total: docCount || 0, by_role: docsByRole },
    entities: entityStats,
    canonical_fields: canonCount || 0,
    unresolved_conflicts: conflictCount || 0,
    series: seriesData,
    coverage_score_pct: coveragePct,
  }), { headers });
}
