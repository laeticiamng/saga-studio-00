# Parser Versioning & Migration

## Overview

Every document processed by the ingestion engine is stamped with a `parser_version` (e.g. `2.0.0`). This allows:
- Detecting legacy documents processed by older parsers
- Batch reprocessing with the current parser
- Tracking extraction quality improvements over time

## Data Model

### `source_documents` columns

| Column | Type | Description |
|--------|------|-------------|
| `parser_version` | TEXT | Version of the parser that produced the current extraction |
| `latest_successful_run` | JSONB | Snapshot of the last successful extraction run |
| `metadata.extraction_debug` | JSONB | Full debug data for the current extraction |
| `metadata.run_history` | JSONB[] | Archived previous extraction runs |

### `parser_version` values
- `"2.0.0"` — Current parser (ZIP/XML for DOCX, Gemini Vision for PDF)
- `"legacy"` — Pre-versioning documents (old Vision API pipeline)
- `NULL` — Never processed

### `latest_successful_run` structure
```json
{
  "parser_version": "2.0.0",
  "entities_count": 42,
  "text_length": 15000,
  "chunks_count": 8,
  "ai_parser_status": "success",
  "completed_at": "2025-04-08T12:00:00Z"
}
```

## Legacy Detection

A document is considered "legacy" if:
1. `parser_version = 'legacy'` (column check — fast)
2. OR `extraction_mode` matches known old statuses: `pdf_vision_api_error`, `pdf_vision_api`, `vision_api`, `pdf_vision`
3. OR `metadata.extraction_debug` exists but has no `parser_version` field

## Reprocessing

### Single document
```
POST /import-document
{ "action": "reprocess", "document_id": "..." }
```

Flow:
1. Archive current `extraction_debug` + `current_active_run` into `run_history`
2. Delete old entities, chunks, mappings, autofill runs, canonical fields from this doc
3. Increment document `version`
4. Set status to `reprocessing`
5. Re-run full `processDocument()` pipeline
6. On success: set `parser_version` to current, populate `latest_successful_run`

### Bulk legacy migration
```
POST /import-document
{ "action": "reprocess_legacy", "project_id": "..." }
```

Flow:
1. Find all documents where `isLegacyDocument()` returns true
2. Reprocess each sequentially
3. Re-run conflict detection after all reprocesses
4. Return summary: reprocessed / failed / skipped counts

## Active Result vs History

- **Active truth**: `latest_successful_run` + current entities in `source_document_entities`
- **History**: `metadata.run_history[]` — archived runs with `archived_at` timestamps
- **Rule**: UI always displays data from the latest active run, never from stale failed runs
- **Audit**: All historical runs preserved for debugging and compliance

## Diagnostic Events

The parser emits structured events into `diagnostic_events` (scope: `ingestion`):

| Event Type | Severity | When |
|-----------|----------|------|
| `parser_completed` | info | Parser succeeded |
| `parser_failed` | error | Parser failed |
| `extraction_completed` | info/warning | AI extraction finished (warning if 0 entities) |

## Version Changelog

| Version | Changes |
|---------|---------|
| `legacy` | Old Vision API pipeline, no ZIP/XML parsing, no versioning |
| `2.0.0` | Native DOCX ZIP/XML parser, Gemini Vision for PDF, structured chunking, multi-batch AI extraction, versioning introduced |
