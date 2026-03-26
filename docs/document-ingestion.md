# Document Ingestion & Autofill

## Overview

The platform supports importing source documents (PDF, DOCX, TXT, Markdown) to automatically pre-fill project fields, eliminating manual data entry.

## Pipeline

1. **Upload** — User drops a file via DocumentsCenter (`/series/:id/documents`)
2. **Storage** — File saved to `source-documents` bucket under `{user_id}/{timestamp}-{filename}`
3. **Text Extraction** — Native text extraction for TXT/MD; basic parsing for PDF/DOCX
4. **Chunking** — Text split into 2000-char segments stored in `source_document_chunks`
5. **AI Entity Extraction** — Gemini 2.5 Flash analyzes text and extracts structured entities
6. **Field Mapping** — Entities mapped to platform fields (series, episodes, characters, bibles)
7. **Confidence Scoring** — Each entity gets extraction/mapping/semantic confidence scores
8. **User Review** — High-confidence fields auto-approved; medium require validation; low shown as suggestions

## Supported Entity Types

| Type | Maps To | Auto-fill Target |
|------|---------|-----------------|
| title | projects.title | CreateSeries/CreateFilm |
| logline | series.logline | Series |
| synopsis | projects.synopsis | Project |
| genre | series.genre | Series |
| tone | series.tone | Series |
| target_audience | series.target_audience | Series |
| character | character_profiles.* | CharacterGallery |
| episode | episodes.* | Episodes |
| location | bibles.content.locations | BibleManager |
| music | bibles.content.music | BibleManager |
| scene | scenes.* | SceneBreakdown |

## Confidence Rules

- **≥ 0.8**: Auto-approved, pre-filled immediately
- **0.5–0.8**: Proposed, requires user validation
- **< 0.5**: Suggestion only, shown but not applied
- **Ambiguity flag**: Set when confidence < 0.6

## Source Hierarchy

Manual edit > Validated document > Raw document > AI suggestion

## Database Tables

- `source_documents` — Uploaded files metadata
- `source_document_chunks` — Text segments
- `source_document_entities` — Extracted entities with confidence
- `source_document_mappings` — Entity → platform field mappings
- `source_document_autofill_runs` — Extraction run statistics
- `field_provenance` — Tracks origin of pre-filled fields

## Edge Functions

- `import-document` — Handles upload registration, text extraction, AI analysis, and mapping generation
