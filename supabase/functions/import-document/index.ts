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

    // Batch import: process multiple already-uploaded documents
    if (action === "batch_process") {
      return await batchProcess(supabase, body, user.id);
    }

    // Detect conflicts across project
    if (action === "detect_conflicts") {
      return await detectConflicts(supabase, body.project_id, user.id);
    }

    // Detect missing info
    if (action === "detect_missing") {
      return await detectMissingInfo(supabase, body.project_id, user.id);
    }

    // Single document extract
    if (action === "extract" && body.document_id) {
      return await processDocument(supabase, body.document_id, user.id);
    }

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
    }), { headers });
  }

  // Download and extract text
  let textContent = "";
  try {
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("source-documents")
      .download(doc.storage_path);
    if (dlErr || !fileData) throw new Error("Cannot download file");

    if (doc.file_type === "txt" || doc.file_type === "markdown") {
      textContent = await fileData.text();
    } else {
      const rawText = await fileData.text();
      textContent = rawText.replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, " ").replace(/\s{3,}/g, "\n\n").trim();
      if (textContent.length < 50) {
        textContent = `[Document binaire: ${doc.file_name}. Extraction texte limitée.]`;
      }
    }
  } catch {
    textContent = "[Extraction texte échouée]";
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

  await supabase.from("source_documents").update({ status: "analyzing", extraction_mode: "native" }).eq("id", documentId);

  // AI: classify document role + extract entities in one call
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
            {
              role: "system",
              content: `Tu es un expert en ingestion de documents pour un studio de production audiovisuelle IA.

ÉTAPE 1 — CLASSIFICATION DU DOCUMENT
Classe le document dans l'un de ces rôles :
${DOCUMENT_ROLES.join(", ")}

ÉTAPE 2 — EXTRACTION D'ENTITÉS
Extrais TOUTES les informations structurées possibles.

Retourne un JSON avec :
{
  "document_role": "le_rôle_détecté",
  "role_confidence": 0.0-1.0,
  "entities": [
    {
      "entity_type": "title|logline|synopsis|genre|tone|target_audience|format|duration|character|episode|season_arc|location|prop|costume|wardrobe|music|lyric|visual_reference|scene|dialogue_sample|theme|continuity_rule|legal_note|vfx_overlay|aspect_ratio|chronology|relationship|mood|cinematic_reference|cliffhanger|ambiance",
      "entity_key": "identifiant court",
      "entity_value": { ... détails structurés ... },
      "source_passage": "passage exact du document",
      "extraction_confidence": 0.0-1.0
    }
  ]
}

Pour les personnages: name, age, role, personality, visual_description, relationships, backstory, arc, wardrobe.
Pour les épisodes: title, synopsis, number, act_structure, scenes.
Pour les scènes: title, description, location, characters, mood, props, time_of_day.
Pour les lieux: name, description, mood, time_period.
Pour la musique: title, artist, placement, mood, bpm.
Pour la continuité: rule, scope, severity.
Pour les relations: character_a, character_b, type, evolution.

Sois exhaustif mais précis. N'invente rien.`
            },
            { role: "user", content: textContent.slice(0, 40000) },
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
      } else if (response.status === 429 || response.status === 402) {
        console.error("AI rate/credit limit:", response.status);
      }
    } catch (e) {
      console.error("AI extraction error:", e);
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
    status: "completed",
    total_fields: entities.length,
    auto_filled: autoFilled,
    needs_review: needsReview,
    rejected: 0,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });

  await supabase.from("source_documents").update({ status: "ready_for_review" }).eq("id", documentId);

  // Audit log
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
  }), { headers });
}

// --- Batch processing ---
async function batchProcess(
  supabase: ReturnType<typeof createClient>,
  body: { project_id: string; document_ids: string[]; series_id?: string },
  userId: string
): Promise<Response> {
  const headers = { ...corsHeaders, "Content-Type": "application/json" };
  const { project_id, document_ids, series_id } = body;

  // Create ingestion run
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

  // After all docs processed, detect conflicts
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

// --- Conflict detection ---
async function detectConflicts(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  _userId: string
): Promise<Response> {
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  // Get all entities across project documents
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

  // Group by entity_type + entity_key
  const groups: Record<string, typeof allEntities> = {};
  for (const e of allEntities) {
    const key = `${e.entity_type}::${e.entity_key.toLowerCase().trim()}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  }

  let conflictsFound = 0;
  for (const [groupKey, groupEntities] of Object.entries(groups)) {
    if (groupEntities.length < 2) continue;

    // Check if values differ
    const uniqueDocs = [...new Set(groupEntities.map(e => e.document_id))];
    if (uniqueDocs.length < 2) continue;

    const valueStrings = groupEntities.map(e => JSON.stringify(e.entity_value));
    const uniqueValues = [...new Set(valueStrings)];
    if (uniqueValues.length < 2) continue;

    // Conflict detected
    const [entityType, entityKey] = groupKey.split("::");
    const first = groupEntities[0];
    const second = groupEntities.find(e => JSON.stringify(e.entity_value) !== JSON.stringify(first.entity_value));
    if (!second) continue;

    // Check if conflict already exists
    const { data: existing } = await supabase
      .from("canonical_conflicts")
      .select("id")
      .eq("project_id", projectId)
      .eq("field_key", entityKey)
      .eq("entity_type", entityType)
      .limit(1);
    if (existing && existing.length > 0) continue;

    // Determine severity based on entity type
    const severity = ["character", "episode", "continuity_rule"].includes(entityType)
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

// --- Missing info detection ---
async function detectMissingInfo(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  _userId: string
): Promise<Response> {
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  // Get project type
  const { data: project } = await supabase
    .from("projects")
    .select("type, synopsis, title")
    .eq("id", projectId)
    .single();
  if (!project) return new Response(JSON.stringify({ missing_count: 0 }), { headers });

  // Get all canonical fields
  const { data: canonicalFields } = await supabase
    .from("canonical_fields")
    .select("field_key, entity_type")
    .eq("project_id", projectId);
  const existingKeys = new Set((canonicalFields || []).map(f => `${f.entity_type}::${f.field_key}`));

  // Get all extracted entities
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

  // Define required fields per project type
  const baseRequired = ["title", "synopsis", "character", "scene", "location", "mood"];
  const typeSpecific: Record<string, string[]> = {
    series: ["episode", "season_arc", "continuity_rule"],
    film: ["chronology", "scene"],
    music_video: ["music", "lyric"],
  };

  const required = [...baseRequired, ...(typeSpecific[project.type] || [])];
  const missing: string[] = [];

  for (const field of required) {
    if (!extractedTypes.has(field) && !existingKeys.has(`project::${field}`)) {
      missing.push(field);
    }
  }

  // Store inferred completions for missing items we can guess
  let inferredCount = 0;
  for (const field of missing) {
    const { data: existing } = await supabase
      .from("inferred_completions")
      .select("id")
      .eq("project_id", projectId)
      .eq("field_key", field)
      .eq("status", "proposed")
      .limit(1);
    if (existing && existing.length > 0) continue;

    await supabase.from("inferred_completions").insert({
      project_id: projectId,
      field_key: field,
      entity_type: "project",
      inferred_value: { note: `Information manquante: ${field}` },
      source_context: `Détecté comme manquant pour un projet de type "${project.type}"`,
      confidence: 0,
      status: "proposed",
    });
    inferredCount++;
  }

  return new Response(JSON.stringify({
    missing_count: missing.length,
    missing_fields: missing,
    inferred_proposed: inferredCount,
  }), { headers });
}

// --- Build canonical fields ---
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

    // Check if canonical field already exists
    const { data: existing } = await supabase
      .from("canonical_fields")
      .select("id, confidence, source_document_id")
      .eq("project_id", projectId)
      .eq("field_key", fieldKey)
      .eq("entity_type", entityType)
      .limit(1);

    if (existing && existing.length > 0) {
      // Only overwrite if new doc has higher priority or confidence
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
    case "scene": return [{ table: "scenes", field: "description", value: entityValue }];
    case "continuity_rule": return [{ table: "continuity_conflicts", field: "description", value: entityValue }];
    case "wardrobe": case "costume": return [{ table: "character_profiles", field: "wardrobe", value: entityValue }];
    case "prop": return [{ table: "bibles", field: "content.props", value: entityValue }];
    case "mood": case "ambiance": return [{ table: "projects", field: "style_preset", value: entityValue }];
    default: return [];
  }
}
