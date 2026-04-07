## Phase 1: Foundation (this message)

### 1. Database Migration
Add to `source_documents`:
- `document_role` (enum: script_master, episode_script, series_bible, character_sheet, moodboard_doc, music_doc, etc.)
- `role_confidence` (float)
- `source_priority` (enum: source_of_truth, preferred_source, supporting_reference, deprecated, draft_only)
- `tags` (text[])

New tables:
- `canonical_conflicts` — detected conflicts between documents (field, doc_a, doc_b, severity, resolution, canonical_value)
- `canonical_fields` — merged canonical project truth (project_id, field_key, canonical_value, source_document_id, approved)
- `ingestion_runs` — batch ingestion tracking (project_id, status, docs_processed, entities_extracted, conflicts_found, missing_detected)
- `inferred_completions` — AI-suggested gap fills (project_id, field_key, inferred_value, source_context, status)

### 2. Edge Function Upgrade (`import-document`)
- Document role auto-classification via AI
- Enhanced extraction with 25+ entity types (props, locations, wardrobe, continuity, legal, VFX, dialogue)
- Conflict detection across existing entities
- Missing information detection
- Image/photo role classification
- Multi-file batch support
- Canonical merge logic

### 3. Frontend Upgrade (`DocumentsCenter`)
- Multi-file drag-and-drop upload
- Project-level (not just series) support
- Document role badges + editor
- Source priority selector
- Conflict resolution panel
- Missing info panel
- Canonical project view
- Batch upload progress
- Image upload support

### 4. Hooks Enhancement
- `useCanonicalConflicts`, `useCanonicalFields`, `useInferredCompletions`
- `useBatchUpload` for multi-file
- `useUpdateDocumentRole`, `useUpdateSourcePriority`
