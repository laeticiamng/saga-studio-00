import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    if (action === "wizard_extract") return await wizardExtract(supabase, body, user.id);

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
    pdf: "pdf", docx: "docx", doc: "docx", txt: "txt",
    md: "markdown", markdown: "markdown", rtf: "rtf",
    jpg: "image", jpeg: "image", png: "image", webp: "image",
    gif: "image", bmp: "image", tiff: "image",
    mp3: "audio", wav: "audio", m4a: "audio", flac: "audio",
    mp4: "video", mov: "video", avi: "video", mkv: "video",
  };
  return typeMap[ext] || "unknown";
}

// ═══════════════════════════════════════════════════
// TEXT EXTRACTION — the critical fix
// ═══════════════════════════════════════════════════

/**
 * Extract text from a DOCX file by parsing the ZIP and reading word/document.xml
 * DOCX is a ZIP containing XML; we parse <w:t> tags to get text.
 */
async function extractDocxText(fileBytes: Uint8Array): Promise<{ text: string; method: string; success: boolean }> {
  try {
    // DOCX is a ZIP file. We need to find word/document.xml inside it.
    // Use a minimal ZIP reader approach.
    const zipData = fileBytes;
    
    // Find the End of Central Directory record
    let eocdOffset = -1;
    for (let i = zipData.length - 22; i >= Math.max(0, zipData.length - 65557); i--) {
      if (zipData[i] === 0x50 && zipData[i+1] === 0x4B && zipData[i+2] === 0x05 && zipData[i+3] === 0x06) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset === -1) throw new Error("Not a valid ZIP/DOCX");

    const cdOffset = zipData[eocdOffset + 16] | (zipData[eocdOffset + 17] << 8) |
                     (zipData[eocdOffset + 18] << 16) | (zipData[eocdOffset + 19] << 24);
    const cdEntries = zipData[eocdOffset + 10] | (zipData[eocdOffset + 11] << 8);

    // Parse central directory to find word/document.xml
    let offset = cdOffset;
    let documentXmlOffset = -1;
    let documentXmlCompressedSize = 0;
    let documentXmlUncompressedSize = 0;
    let documentXmlMethod = 0;

    for (let entry = 0; entry < cdEntries; entry++) {
      if (offset + 46 > zipData.length) break;
      const sig = zipData[offset] | (zipData[offset+1] << 8) | (zipData[offset+2] << 16) | (zipData[offset+3] << 24);
      if (sig !== 0x02014B50) break;

      const method = zipData[offset + 10] | (zipData[offset + 11] << 8);
      const compSize = zipData[offset + 20] | (zipData[offset + 21] << 8) | (zipData[offset + 22] << 16) | (zipData[offset + 23] << 24);
      const uncompSize = zipData[offset + 24] | (zipData[offset + 25] << 8) | (zipData[offset + 26] << 16) | (zipData[offset + 27] << 24);
      const nameLen = zipData[offset + 28] | (zipData[offset + 29] << 8);
      const extraLen = zipData[offset + 30] | (zipData[offset + 31] << 8);
      const commentLen = zipData[offset + 32] | (zipData[offset + 33] << 8);
      const localHeaderOffset = zipData[offset + 42] | (zipData[offset + 43] << 8) | (zipData[offset + 44] << 16) | (zipData[offset + 45] << 24);

      const nameBytes = zipData.slice(offset + 46, offset + 46 + nameLen);
      const fileName = new TextDecoder().decode(nameBytes);

      if (fileName === "word/document.xml") {
        documentXmlOffset = localHeaderOffset;
        documentXmlCompressedSize = compSize;
        documentXmlUncompressedSize = uncompSize;
        documentXmlMethod = method;
      }

      offset += 46 + nameLen + extraLen + commentLen;
    }

    if (documentXmlOffset === -1) throw new Error("word/document.xml not found in DOCX");

    // Read local file header to get to data
    const localNameLen = zipData[documentXmlOffset + 26] | (zipData[documentXmlOffset + 27] << 8);
    const localExtraLen = zipData[documentXmlOffset + 28] | (zipData[documentXmlOffset + 29] << 8);
    const dataStart = documentXmlOffset + 30 + localNameLen + localExtraLen;

    let xmlBytes: Uint8Array;
    if (documentXmlMethod === 0) {
      // Stored (no compression)
      xmlBytes = zipData.slice(dataStart, dataStart + documentXmlUncompressedSize);
    } else if (documentXmlMethod === 8) {
      // Deflated — use DecompressionStream
      const compressedData = zipData.slice(dataStart, dataStart + documentXmlCompressedSize);
      // Create a raw deflate stream (no zlib header) — Deno requires "deflate-raw"
      const ds = new DecompressionStream("deflate-raw");
      const writer = ds.writable.getWriter();
      writer.write(compressedData);
      writer.close();
      const reader = ds.readable.getReader();
      const chunks: Uint8Array[] = [];
      let done = false;
      while (!done) {
        const result = await reader.read();
        if (result.value) chunks.push(result.value);
        done = result.done;
      }
      const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
      xmlBytes = new Uint8Array(totalLen);
      let pos = 0;
      for (const chunk of chunks) {
        xmlBytes.set(chunk, pos);
        pos += chunk.length;
      }
    } else {
      throw new Error(`Unsupported compression method: ${documentXmlMethod}`);
    }

    const xmlString = new TextDecoder("utf-8").decode(xmlBytes);

    // Extract text from <w:t> tags, respecting <w:p> as paragraphs
    const paragraphs: string[] = [];
    // Split by paragraph tags
    const pRegex = /<w:p[\s>][^]*?<\/w:p>/g;
    let pMatch;
    while ((pMatch = pRegex.exec(xmlString)) !== null) {
      const pBlock = pMatch[0];
      // Extract all <w:t> content within this paragraph
      const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      let tMatch;
      let paraText = "";
      while ((tMatch = tRegex.exec(pBlock)) !== null) {
        paraText += tMatch[1];
      }
      if (paraText.trim()) {
        // Check if this is a heading by looking for <w:pStyle w:val="Heading
        const isHeading = /<w:pStyle\s+w:val="(?:Heading|Titre|heading)/i.test(pBlock);
        if (isHeading) {
          paragraphs.push("\n## " + paraText.trim());
        } else {
          paragraphs.push(paraText.trim());
        }
      }
    }

    // Decode XML entities
    const text = paragraphs.join("\n")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));

    if (text.length < 20) throw new Error(`DOCX extracted text too short (${text.length} chars) — likely corrupted or empty document`);

    return { text, method: "docx_xml_parse", success: true };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("DOCX extraction error:", errMsg);
    return { text: "", method: `docx_parse_failed: ${errMsg.slice(0, 200)}`, success: false };
  }
}

/**
 * Extract text from a PDF using Gemini Vision API.
 * Sends the raw PDF as base64 inline_data to Gemini which can natively read PDFs.
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
    // Process in chunks to avoid call stack limits
    const CHUNK = 8192;
    for (let i = 0; i < len; i += CHUNK) {
      const slice = fileBytes.subarray(i, Math.min(i + CHUNK, len));
      for (let j = 0; j < slice.length; j++) {
        binary += String.fromCharCode(slice[j]);
      }
    }
    const base64Pdf = btoa(binary);

    // Use Gemini to extract text from the PDF
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
      return { text: "", method: "pdf_vision_api_error", success: false };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    
    if (text.length < 20) {
      return { text: "", method: "pdf_vision_empty", success: false };
    }

    return { text, method: "pdf_vision_api", success: true };
  } catch (e) {
    console.error("PDF Vision extraction error:", e);
    return { text: "", method: "pdf_vision_failed", success: false };
  }
}

/**
 * Unified text extraction dispatcher.
 * Routes to the correct extractor based on file type.
 */
async function extractTextFromFile(
  fileData: Blob,
  fileType: string,
  fileName: string
): Promise<{ text: string; method: string; success: boolean; charCount: number }> {
  // Plain text files
  if (fileType === "txt" || fileType === "markdown" || fileType === "rtf") {
    const text = await fileData.text();
    return { text, method: "plain_text", success: text.length > 0, charCount: text.length };
  }

  const bytes = new Uint8Array(await fileData.arrayBuffer());

  // DOCX files — parse XML from ZIP (NEVER fallback to PDF vision)
  if (fileType === "docx") {
    const result = await extractDocxText(bytes);
    if (result.success && result.text.length > 20) {
      console.log(`DOCX extraction success: ${fileName} → ${result.text.length} chars`);
      return { ...result, charCount: result.text.length };
    }
    // DOCX failed — report honestly as DOCX failure, do NOT send to PDF extractor
    console.error(`DOCX native parse failed for ${fileName}: method=${result.method}, textLen=${result.text.length}`);
    return {
      text: result.text,
      method: result.method || "docx_parse_failed",
      success: false,
      charCount: result.text.length,
    };
  }

  // PDF files — use Vision API
  if (fileType === "pdf") {
    const result = await extractPdfText(bytes);
    console.log(`PDF extraction: ${fileName} → ${result.text.length} chars (${result.method})`);
    return { ...result, charCount: result.text.length };
  }

  // Unknown binary — try Vision API as last resort
  console.log(`Unknown file type ${fileType} for ${fileName}, trying Vision API`);
  const result = await extractPdfText(bytes);
  return { ...result, charCount: result.text.length };
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

Types d'entités : title, logline, synopsis, genre, tone, target_audience, format, duration, character, location, prop, costume, wardrobe, music, lyric, visual_reference, scene, dialogue_sample, theme, continuity_rule, legal_note, vfx_overlay, aspect_ratio, chronology, relationship, mood, cinematic_reference, cliffhanger, ambiance.

Pour les personnages: name, age, role, personality, visual_description, relationships, backstory, arc, wardrobe, gender.
Pour les scènes: title, description, location, characters, mood, props, time_of_day, int_ext.
Pour les lieux: name, description, mood, time_period.
Pour la continuité: rule, scope, severity.
Pour les relations: character_a, character_b, type, evolution.

IMPORTANT: Si le document contient clairement des personnages, lieux, scènes — extrais-les TOUS. Ne retourne JAMAIS un tableau vide si le contenu est riche.`;

  if (projectType === "series") {
    return base + `

EXTRACTION SPÉCIFIQUE SÉRIES :
- Extrais la STRUCTURE COMPLÈTE : nombre de saisons, épisodes par saison, titres d'épisodes.
- Pour chaque épisode détecté, extrais : title, number, synopsis, scenes[], act_structure, cliffhanger_end.
- Identifie les personnages RÉCURRENTS vs INVITÉS.
- Extrais les RÈGLES DE CONTINUITÉ entre épisodes.
- Si "MINI-ÉPISODE" est utilisé, traite-le comme entity_type="episode".
- Identifie les dépendances de continuité entre épisodes.

Types additionnels : episode, season_arc, continuity_dependency, recurring_element, episode_callback.`;
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
// PROCESS DOCUMENT (core pipeline)
// ═══════════════════════════════════════════════════

async function processDocument(
  supabase: ReturnType<typeof createClient>,
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

  // ─── Download and extract text using proper extractors ───
  let textContent = "";
  let extractionMethod = "unknown";
  let parserSuccess = false;

  try {
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("source-documents")
      .download(doc.storage_path);
    if (dlErr || !fileData) throw new Error("Cannot download file: " + (dlErr?.message || "no data"));

    const extraction = await extractTextFromFile(fileData, doc.file_type, doc.file_name);
    textContent = extraction.text;
    extractionMethod = extraction.method;
    parserSuccess = extraction.success;
    
    console.log(`Extraction complete for ${doc.file_name}: method=${extractionMethod} success=${parserSuccess} chars=${extraction.charCount}`);
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Unknown download error";
    console.error(`File extraction failed for ${doc.file_name}:`, errMsg);
    extractionMethod = "download_failed";
    parserSuccess = false;
    textContent = "";
  }

  // If extraction failed, mark document and return honest failure — do NOT proceed to AI
  if (!parserSuccess || textContent.length < 20) {
    const failureStatus = doc.file_type === "docx" ? "parsing_failed" : "parsing_failed";
    await supabase.from("source_documents").update({
      status: failureStatus,
      extraction_mode: extractionMethod,
      metadata: {
        ...(typeof doc.metadata === "object" && doc.metadata ? doc.metadata : {}),
        extraction_debug: {
          parser_chosen: doc.file_type === "docx" ? "docx_xml_parse" : doc.file_type === "pdf" ? "pdf_vision_api" : "plain_text",
          parser_success: false,
          extracted_text_length: textContent.length,
          text_preview: textContent.slice(0, 500) || "(empty)",
          fallback_taken: "none",
          final_extraction_mode: extractionMethod,
          error_message: `Extraction échouée (${extractionMethod}). Le fichier n'a pas pu être lu.`,
          timestamp: new Date().toISOString(),
        },
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
      parser_error: `Extraction échouée (${extractionMethod}). Le fichier n'a pas pu être lu.`,
      extraction_method: extractionMethod,
      extraction_debug: {
        parser_chosen: doc.file_type === "docx" ? "docx_xml_parse" : doc.file_type === "pdf" ? "pdf_vision_api" : "plain_text",
        parser_success: false,
        extracted_text_length: textContent.length,
        text_preview: textContent.slice(0, 500) || "(empty)",
        fallback_taken: "none",
        final_extraction_mode: extractionMethod,
      },
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

  await supabase.from("source_documents").update({
    status: "analyzing",
    extraction_mode: extractionMethod,
    metadata: {
      ...(typeof doc.metadata === "object" && doc.metadata ? doc.metadata : {}),
      extraction_debug: {
        parser_chosen: extractionMethod,
        parser_success: true,
        extracted_text_length: textContent.length,
        text_preview: textContent.slice(0, 500),
        fallback_taken: "none",
        final_extraction_mode: extractionMethod,
        error_message: null,
        timestamp: new Date().toISOString(),
      },
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
    try {
      // Send up to 60k chars for better extraction on large docs
      const textForAI = textContent.slice(0, 60000);
      
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
            { role: "user", content: textForAI },
          ],
          temperature: 0.15,
          response_format: { type: "json_object" },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content || "{}";
        const parsed = JSON.parse(rawContent);
        entities = parsed.entities || [];
        detectedRole = parsed.document_role || "unknown";
        roleConfidence = Number(parsed.role_confidence) || 0;
        aiParserStatus = "success";
        console.log(`AI extraction for ${doc.file_name}: role=${detectedRole} entities=${entities.length}`);
      } else {
        const errBody = await response.text();
        console.error("AI extraction API error:", response.status, errBody);
        aiParserStatus = `api_error_${response.status}`;
      }
    } catch (e) {
      console.error("AI extraction error:", e);
      aiParserStatus = "exception";
    }
  }

  // Update document with classified role
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

  await supabase.from("source_documents").update({ status: "ready_for_review" }).eq("id", documentId);

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
    extraction_method: extractionMethod,
    text_length: textContent.length,
    chunks_count: chunks.length,
    extraction_debug: {
      parser_chosen: extractionMethod,
      parser_success: parserSuccess,
      extracted_text_length: textContent.length,
      text_preview: textContent.slice(0, 500),
      fallback_taken: "none",
      final_extraction_mode: extractionMethod,
      ai_parser_status: aiParserStatus,
    },
  }), { headers });
}

// ═══════════════════════════════════════════════════
// CONTEXTUAL RETRIEVAL FOR GENERATION
// ═══════════════════════════════════════════════════

async function retrieveContext(
  supabase: ReturnType<typeof createClient>,
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
  const docIds = (docs || []).map(d => d.id);

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

  const relevantEntities = (entities || []).filter(e => {
    if (scope === "project") return true;
    if (scope === "character" && ["character", "relationship", "wardrobe", "costume"].includes(e.entity_type)) return true;
    if (scope === "scene" && ["scene", "location", "prop", "mood", "ambiance", "visual_reference", "continuity_rule"].includes(e.entity_type)) return true;
    if (scope === "episode" && ["episode", "scene", "character", "continuity_rule", "cliffhanger", "season_arc"].includes(e.entity_type)) return true;
    if (scope === "timeline" && ["chronology", "scene", "episode", "music", "montage_note"].includes(e.entity_type)) return true;
    if (scope === "continuity" && ["continuity_rule", "character", "wardrobe", "prop", "location", "recurring_element"].includes(e.entity_type)) return true;
    return false;
  });

  const docPriorityMap: Record<string, number> = {};
  for (const d of docs || []) {
    docPriorityMap[d.id] = PRIORITY_ORDER[d.source_priority || "supporting_reference"] || 3;
  }
  relevantEntities.sort((a, b) => {
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
    .filter(e => e.entity_type === "continuity_rule")
    .map(e => ({ rule: e.entity_value, key: e.entity_key, confidence: e.extraction_confidence }));
  context.continuity_rules = continuityRules;

  const styleEntities = (entities || [])
    .filter(e => ["visual_reference", "mood", "ambiance", "cinematic_reference"].includes(e.entity_type))
    .slice(0, 10)
    .map(e => ({ type: e.entity_type, key: e.entity_key, value: e.entity_value }));
  context.style_references = styleEntities;

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
  supabase: ReturnType<typeof createClient>,
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
  supabase: ReturnType<typeof createClient>,
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

  const docIds = docs.map(d => d.id);
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
    const uniqueDocs = [...new Set(groupEntities.map(e => e.document_id))];
    if (uniqueDocs.length < 2) continue;
    const valueStrings = groupEntities.map(e => JSON.stringify(e.entity_value));
    const uniqueValues = [...new Set(valueStrings)];
    if (uniqueValues.length < 2) continue;

    const [entityType, entityKey] = groupKey.split("::");
    const first = groupEntities[0];
    const second = groupEntities.find(e => JSON.stringify(e.entity_value) !== JSON.stringify(first.entity_value));
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
  supabase: ReturnType<typeof createClient>,
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
  const existingKeys = new Set((canonicalFields || []).map(f => `${f.entity_type}::${f.field_key}`));

  const { data: docs } = await supabase
    .from("source_documents")
    .select("id")
    .eq("project_id", projectId);
  const docIds = (docs || []).map(d => d.id);
  const { data: entities } = await supabase
    .from("source_document_entities")
    .select("entity_type")
    .in("document_id", docIds.length > 0 ? docIds : ["none"]);
  const extractedTypes = new Set((entities || []).map(e => e.entity_type));

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
  supabase: ReturnType<typeof createClient>,
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
  supabase: ReturnType<typeof createClient>,
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
  const extractedTypes = new Set((allEntities || []).map(e => e.entity_type));
  const missingLabels: Record<string, string> = {
    title: "Titre du projet",
    synopsis: "Synopsis / Brief",
    character: "Personnages principaux",
    episode: "Structure des épisodes",
    scene: "Scènes",
    tone: "Ton / Ambiance",
  };

  // Only declare missing if extraction actually ran successfully on at least one doc
  const anyDocProcessed = (docMeta || []).some(d =>
    d.status === "ready_for_review" || d.status === "reviewed" || d.status === "applied"
  );
  if (anyDocProcessed) {
    prefill.missingFields = required
      .filter(f => !extractedTypes.has(f))
      .map(f => missingLabels[f] || f);
  } else {
    prefill.missingFields = ["Analyse en cours…"];
  }

  // Include parser diagnostics per document
  const documentDiagnostics = (docMeta || []).map(d => ({
    id: d.id,
    fileName: d.file_name,
    role: d.document_role,
    roleConfidence: d.role_confidence,
    fileType: d.file_type,
    extractionMode: d.extraction_mode,
    status: d.status,
    entitiesCount: (allEntities || []).filter(e => e.document_id === d.id).length,
  }));

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
  supabase: ReturnType<typeof createClient>,
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

  // ─── Download and extract text using proper extractors ───
  let textContent = "";
  let extractionMethod = "unknown";
  let parserSuccess = false;

  try {
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("source-documents")
      .download(doc.storage_path);
    if (dlErr || !fileData) throw new Error("Cannot download file");

    const extraction = await extractTextFromFile(fileData, doc.file_type, doc.file_name);
    textContent = extraction.text;
    extractionMethod = extraction.method;
    parserSuccess = extraction.success;
    
    console.log(`WizardExtraction for ${doc.file_name}: method=${extractionMethod} success=${parserSuccess} chars=${extraction.charCount}`);
  } catch (e) {
    console.error(`File extraction failed for ${doc.file_name}:`, e);
    extractionMethod = "download_failed";
    parserSuccess = false;
  }

  // If extraction failed, mark honestly and stop — do NOT proceed to AI
  if (!parserSuccess || textContent.length < 20) {
    await supabase.from("source_documents").update({
      status: "parsing_failed",
      extraction_mode: extractionMethod,
      metadata: {
        ...(typeof doc.metadata === "object" && doc.metadata ? doc.metadata : {}),
        extraction_debug: {
          parser_chosen: doc.file_type === "docx" ? "docx_xml_parse" : doc.file_type === "pdf" ? "pdf_vision_api" : "plain_text",
          parser_success: false,
          extracted_text_length: textContent.length,
          text_preview: textContent.slice(0, 500) || "(empty)",
          fallback_taken: "none",
          final_extraction_mode: extractionMethod,
          error_message: `Extraction échouée (${extractionMethod})`,
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
  supabase: ReturnType<typeof createClient>,
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
