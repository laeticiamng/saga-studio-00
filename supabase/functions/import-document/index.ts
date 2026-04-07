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

// ─── Workflow-specific extraction prompts ───

function getWorkflowPrompt(projectType: string): string {
  const base = `Tu es un expert en ingestion de documents pour un studio de production audiovisuelle IA.

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
      "entity_type": "...",
      "entity_key": "identifiant court",
      "entity_value": { ... détails structurés ... },
      "source_passage": "passage exact du document",
      "extraction_confidence": 0.0-1.0
    }
  ]
}

Types d'entités universels : title, logline, synopsis, genre, tone, target_audience, format, duration, character, location, prop, costume, wardrobe, music, lyric, visual_reference, scene, dialogue_sample, theme, continuity_rule, legal_note, vfx_overlay, aspect_ratio, chronology, relationship, mood, cinematic_reference, cliffhanger, ambiance.

Pour les personnages: name, age, role, personality, visual_description, relationships, backstory, arc, wardrobe.
Pour les scènes: title, description, location, characters, mood, props, time_of_day.
Pour les lieux: name, description, mood, time_period.
Pour la continuité: rule, scope, severity.
Pour les relations: character_a, character_b, type, evolution.`;

  if (projectType === "series") {
    return base + `

EXTRACTION SPÉCIFIQUE SÉRIES :
- Extrais la STRUCTURE COMPLÈTE : nombre de saisons, épisodes par saison, titres d'épisodes.
- Pour chaque épisode détecté, extrais : title, number, synopsis, scenes[], act_structure, cliffhanger_end.
- Extrais les arcs de saison (season_arc) : arc narratif global, thèmes récurrents, progression.
- Identifie les personnages RÉCURRENTS vs INVITÉS.
- Extrais les RÈGLES DE CONTINUITÉ entre épisodes : quels éléments doivent rester cohérents.
- Extrais le rythme narratif : cliffhangers, payoffs, callbacks entre épisodes.
- Si un document contient plusieurs épisodes, sépare-les en entités distinctes avec entity_type="episode".
- Identifie les dépendances de continuité : quel épisode dépend de quel autre pour la cohérence.

Types additionnels pour séries : episode, season_arc, continuity_dependency, recurring_element, episode_callback.`;
  }

  if (projectType === "film") {
    return base + `

EXTRACTION SPÉCIFIQUE FILM :
- Extrais la STRUCTURE EN ACTES : Acte 1 (setup), Acte 2 (confrontation), Acte 3 (résolution).
- Extrais la CHRONOLOGIE NARRATIVE : séquence temporelle des scènes, flashbacks, ellipses.
- Identifie les MOTIFS VISUELS RÉCURRENTS : objets symboliques, couleurs dominantes, leitmotifs.
- Extrais les ARCS DE PERSONNAGES : transformation du début à la fin.
- Identifie les SCÈNES CLÉ (prestige shots) : moments visuellement forts nécessitant une attention particulière.
- Extrais la logique de MONTAGE : transitions entre scènes, rythme dramatique.
- Identifie les contraintes de CONTINUITÉ DÉCOR/COSTUME pour les séquences longues.

Types additionnels pour film : act_structure, narrative_sequence, visual_motif, character_arc, prestige_shot, montage_note.`;
  }

  if (projectType === "music_video") {
    return base + `

EXTRACTION SPÉCIFIQUE CLIP MUSICAL :
- Extrais les PAROLES complètes si présentes, avec découpage par section (couplet, refrain, pont, outro).
- Extrais le CONCEPT VISUEL : storyline, symbolisme, univers esthétique.
- Identifie les SECTIONS MUSICALES : intro, verse, chorus, bridge, outro avec timestamps si disponibles.
- Extrais le BPM et la TONALITÉ si mentionnés.
- Identifie les CUES DE PERFORMANCE : moments où l'artiste lip-synce, danse, joue.
- Extrais les TRANSITIONS VISUELLES liées aux changements musicaux.
- Identifie les SHOTS ICONIQUES requis : plans signature du clip.
- Extrais le MOOD PAR SECTION : comment l'ambiance évolue avec la musique.

Types additionnels pour clip : lyric_section, music_section, performance_cue, beat_map, iconic_shot, section_mood, artist_lookdev.`;
  }

  return base + "\nSois exhaustif mais précis. N'invente rien.";
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

// ─── Contextual Retrieval for Generation ───

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

  // 1. Get approved canonical fields
  let cfQuery = supabase
    .from("canonical_fields")
    .select("*")
    .eq("project_id", project_id)
    .eq("approved", true);
  if (entity_types?.length) cfQuery = cfQuery.in("entity_type", entity_types);
  const { data: canonicalFields } = await cfQuery;

  // 2. Get relevant entities based on scope
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

  // 3. Build scoped context
  const context: Record<string, unknown> = {
    project_canon: {},
    entities: [],
    continuity_rules: [],
    style_references: [],
  };

  // Add canonical fields as top-level truth
  const canon: Record<string, Record<string, unknown>> = {};
  for (const f of canonicalFields || []) {
    if (!canon[f.entity_type]) canon[f.entity_type] = {};
    canon[f.entity_type][f.field_key] = f.canonical_value;
  }
  context.project_canon = canon;

  // Filter entities by scope relevance
  const relevantEntities = (entities || []).filter(e => {
    if (scope === "project") return true;
    if (scope === "character" && ["character", "relationship", "wardrobe", "costume"].includes(e.entity_type)) return true;
    if (scope === "scene" && ["scene", "location", "prop", "mood", "ambiance", "visual_reference", "continuity_rule"].includes(e.entity_type)) return true;
    if (scope === "episode" && ["episode", "scene", "character", "continuity_rule", "cliffhanger", "season_arc"].includes(e.entity_type)) return true;
    if (scope === "timeline" && ["chronology", "scene", "episode", "music", "montage_note"].includes(e.entity_type)) return true;
    if (scope === "continuity" && ["continuity_rule", "character", "wardrobe", "prop", "location", "recurring_element"].includes(e.entity_type)) return true;
    return false;
  });

  // Sort by doc priority + confidence
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

  // Trim to fit context window
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

  // Add continuity rules explicitly
  const continuityRules = (entities || [])
    .filter(e => e.entity_type === "continuity_rule")
    .map(e => ({ rule: e.entity_value, key: e.entity_key, confidence: e.extraction_confidence }));
  context.continuity_rules = continuityRules;

  // Style references from moodboard/wardrobe docs
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

// ─── Batch processing ───

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

// ─── Conflict detection ───

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

// ─── Missing info detection ───

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

  // AI-powered inference for missing items
  let inferredCount = 0;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  // Gather existing context for inference
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

    // Try AI inference if we have context
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
            confidence = Math.min(Number(parsed.confidence) || 0.3, 0.7); // Cap at 0.7 for inferred
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

// ─── Build canonical fields ───

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

// ─── Wizard pre-project extraction ───

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

  // Process each document with the project-type-specific prompt
  for (const docId of document_ids) {
    // Temporarily set a fake project type context for extraction
    const { data: doc } = await supabase
      .from("source_documents")
      .select("status")
      .eq("id", docId)
      .single();
    if (doc?.status === "ready_for_review") continue; // already processed
    // processDocument will use generic prompt since no project_id exists yet
    // We need to override that by temporarily storing project_type info
    await processDocumentWithType(supabase, docId, userId, project_type);
  }

  // Gather all extracted entities across all documents
  const { data: allEntities } = await supabase
    .from("source_document_entities")
    .select("*, document:source_documents!inner(file_name)")
    .in("document_id", document_ids)
    .gte("extraction_confidence", 0.4)
    .order("extraction_confidence", { ascending: false });

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
            key: "title",
            label: "Titre",
            value: String(val.value || e.entity_key),
            confidence: e.extraction_confidence,
            sourceDoc: docName,
            multiline: false,
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
            confidence: e.extraction_confidence,
            sourceDoc: docName,
            multiline: true,
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

  // Detect missing fields based on project type
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
  prefill.missingFields = required
    .filter(f => !extractedTypes.has(f))
    .map(f => missingLabels[f] || f);

  // Get document roles
  const { data: docMeta } = await supabase
    .from("source_documents")
    .select("id, file_name, document_role, role_confidence, file_type")
    .in("id", document_ids);

  return new Response(JSON.stringify({
    prefill,
    extractedFields,
    documents: docMeta || [],
    documentsProcessed: document_ids.length,
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
    },
  });
}

// ─── Helpers ───

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
    // Workflow-specific mappings
    case "act_structure": return [{ table: "bibles", field: "content.act_structure", value: entityValue }];
    case "season_arc": return [{ table: "bibles", field: "content.season_arc", value: entityValue }];
    case "beat_map": return [{ table: "audio_analysis", field: "beats_json", value: entityValue }];
    case "lyric_section": return [{ table: "bibles", field: "content.lyrics", value: entityValue }];
    case "performance_cue": return [{ table: "bibles", field: "content.performance_cues", value: entityValue }];
    case "prestige_shot": return [{ table: "bibles", field: "content.prestige_shots", value: entityValue }];
    case "visual_motif": return [{ table: "bibles", field: "content.visual_motifs", value: entityValue }];
    case "character_arc": return [{ table: "character_profiles", field: "arc", value: entityValue }];
    default: return [];
  }
}
