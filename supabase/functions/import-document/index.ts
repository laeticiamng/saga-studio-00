import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * import-document: Handles document upload, text extraction, AI entity extraction, and autofill mapping.
 * Full pipeline: upload → extract text → AI parse entities → propose mappings
 */
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
    const { document_id, action } = body;

    // Action: extract — process an already-uploaded document
    if (action === "extract" && document_id) {
      return await processDocument(supabase, document_id, user.id);
    }

    // Action: register — create a source_document record after file upload
    const { project_id, series_id, file_name, file_type, file_size_bytes, storage_path } = body;
    if (!file_name || !storage_path) throw new Error("file_name and storage_path required");

    const { data: doc, error: docErr } = await supabase
      .from("source_documents")
      .insert({
        project_id: project_id || null,
        series_id: series_id || null,
        uploaded_by: user.id,
        file_name,
        file_type: detectFileType(file_name),
        file_size_bytes: file_size_bytes || 0,
        storage_path,
        status: "uploaded",
      })
      .select()
      .single();
    if (docErr) throw docErr;

    // Auto-start extraction
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
  };
  return typeMap[ext] || "unknown";
}

async function processDocument(
  supabase: ReturnType<typeof createClient>,
  documentId: string,
  userId: string
): Promise<Response> {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  // Fetch document
  const { data: doc, error: docErr } = await supabase
    .from("source_documents")
    .select("*")
    .eq("id", documentId)
    .single();
  if (docErr || !doc) throw new Error("Document not found");

  // Update status
  await supabase.from("source_documents").update({ status: "extracting" }).eq("id", documentId);

  // Download file from storage
  let textContent = "";
  try {
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("source-documents")
      .download(doc.storage_path);
    if (dlErr || !fileData) throw new Error("Cannot download file");

    // Extract text based on file type
    if (doc.file_type === "txt" || doc.file_type === "markdown") {
      textContent = await fileData.text();
    } else if (doc.file_type === "pdf" || doc.file_type === "docx" || doc.file_type === "rtf") {
      // For binary formats, extract what we can from raw text
      // In production, use a parsing service — here we attempt basic extraction
      const rawText = await fileData.text();
      textContent = rawText.replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, " ").replace(/\s{3,}/g, "\n\n").trim();
      if (textContent.length < 50) {
        textContent = `[Document binaire détecté: ${doc.file_name}. Extraction texte limitée. Contenu brut disponible pour analyse IA.]`;
      }
    } else {
      textContent = await fileData.text();
    }
  } catch {
    textContent = "[Extraction texte échouée — analyse manuelle requise]";
  }

  // Store chunks
  const chunks = splitIntoChunks(textContent, 2000);
  for (let i = 0; i < chunks.length; i++) {
    await supabase.from("source_document_chunks").insert({
      document_id: documentId,
      chunk_index: i,
      content: chunks[i],
      section_type: i === 0 ? "header" : "body",
    });
  }

  // Update status
  await supabase.from("source_documents").update({ status: "analyzing", extraction_mode: "native" }).eq("id", documentId);

  // AI Entity Extraction
  let entities: Array<Record<string, unknown>> = [];
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Tu es un expert en extraction d'informations pour un studio de production de séries animées/IA.
Analyse le document ci-dessous et extrais TOUTES les informations structurées possibles.

Retourne un JSON avec un tableau "entities" où chaque entité a:
- entity_type: "title" | "logline" | "synopsis" | "genre" | "tone" | "target_audience" | "format" | "duration" | "character" | "episode" | "season_arc" | "location" | "prop" | "costume" | "music" | "visual_reference" | "scene" | "dialogue_sample" | "theme"
- entity_key: identifiant court (ex: nom du personnage, titre de l'épisode)
- entity_value: objet avec les détails extraits (varie selon entity_type)
- source_passage: le passage exact du document d'où vient cette info
- extraction_confidence: 0-1 (confiance dans l'extraction)

Pour les personnages, entity_value doit contenir: name, age, role, personality, visual_description, relationships, backstory, arc, wardrobe si détectés.
Pour les épisodes: title, synopsis, number si détectés.
Pour les scènes: title, description, location, characters, mood si détectés.

Sois exhaustif mais précis. Ne fabrique rien — n'extrais que ce qui est dans le texte.`
          },
          { role: "user", content: textContent.slice(0, 30000) },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
      entities = parsed.entities || [];
    }
  } catch {
    // AI unavailable — mark for manual review
  }

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

  // Create autofill run
  const autoFilled = entities.filter(e => Number(e.extraction_confidence) >= 0.8).length;
  const needsReview = entities.filter(e => Number(e.extraction_confidence) >= 0.5 && Number(e.extraction_confidence) < 0.8).length;
  
  await supabase.from("source_document_autofill_runs").insert({
    document_id: documentId,
    status: "completed",
    total_fields: entities.length,
    auto_filled: autoFilled,
    needs_review: needsReview,
    rejected: 0,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });

  // Update document status
  await supabase.from("source_documents").update({ status: "ready_for_review" }).eq("id", documentId);

  // Audit log
  await supabase.from("audit_logs").insert({
    user_id: userId,
    action: "document_imported",
    entity_type: "source_document",
    entity_id: documentId,
    details: {
      file_name: doc.file_name,
      entities_found: entities.length,
      auto_filled: autoFilled,
      needs_review: needsReview,
      mappings_created: mappingCount,
    },
  });

  return new Response(JSON.stringify({
    entities_found: entities.length,
    auto_filled: autoFilled,
    needs_review: needsReview,
    mappings_created: mappingCount,
    status: "ready_for_review",
  }), { headers: corsHeaders });
}

function splitIntoChunks(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + maxLen));
    i += maxLen;
  }
  return chunks.length > 0 ? chunks : [""];
}

function estimateMappingConfidence(entity: Record<string, unknown>): number {
  const directTypes = ["title", "logline", "synopsis", "genre", "tone", "target_audience"];
  if (directTypes.includes(entity.entity_type as string)) return 0.9;
  if (entity.entity_type === "character") return 0.8;
  if (entity.entity_type === "episode") return 0.75;
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
    default: return [];
  }
}
