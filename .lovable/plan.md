

# Execution Master Plan: Repo-Level Hardening & Operational Maturity

## What This Plan Addresses

The codebase has strong product architecture but is missing the **execution layer** needed for production: parser versioning is informal, observability is scattered, regression tests use toy data, runbooks cover only 7 failure classes, docs describe an older product shape, and there's no explicit go-live checklist.

This plan delivers 12 concrete work items to make the repository **migratable, debuggable, testable, documented, and shippable**.

---

## Part 1 — Parser Versioning & Migration (P0)

### 1A. Database: Add `parser_version` column to `source_documents`

**Migration**: Add `parser_version TEXT DEFAULT NULL` to `source_documents`. Backfill existing rows: set `parser_version = '2.0.0'` where `metadata->extraction_debug->parser_version` exists, otherwise `'legacy'`.

### 1B. Persist `parser_version` in `import-document`

In `processDocument()`, after successful extraction, write `parser_version: PARSER_VERSION` to both the `metadata.extraction_debug` object AND the new `parser_version` column. This makes legacy detection a simple column check instead of JSON parsing.

### 1C. Active Result vs History Model

The `reprocessDocument` function already archives old runs into `metadata.run_history` and clears `current_active_run`. Formalize this:
- Add a `latest_successful_run` JSONB field to `source_documents` (contains parser_version, entities_count, text_length, timestamp)
- On successful extraction, populate `latest_successful_run`
- UI and backend always use `latest_successful_run` for display — never stale failed data
- Historical failures remain in `run_history` for audit

### 1D. Verify reprocess actually works end-to-end

The `reprocessDocument` and `reprocessLegacyDocuments` functions exist and look correct. Test them via `curl_edge_functions` to confirm the full cycle works: archive → clear → re-extract → new entities.

---

## Part 2 — Observability Foundation (P0)

### 2A. Structured parser diagnostics in `import-document`

Add a `diagnostic_events` insert at each critical step of document processing:
- `parser_selected` (file_name, file_type, parser, parser_version)
- `parser_completed` (duration_ms, text_length, chunk_count, success)
- `parser_failed` (error_message, fallback_used)
- `extraction_completed` (entities_count, classification_status)

These go into the existing `diagnostic_events` table with `scope = 'ingestion'`.

### 2B. Raw extraction preview

In `debugDocument()`, add `text_preview` (first 500 chars of extracted text) and `chunk_previews` (first 200 chars of each chunk) to the response. Already partially there — extend it.

### 2C. Frontend: Ingestion Diagnostics Panel

Extend `DiagnosticsPanel` to show `scope = 'ingestion'` events. Add a dedicated tab in `DocumentsCenter` or `ProjectView` showing:
- Per-document parser status, version, duration
- Latest failure reason with raw error
- Text preview for successfully parsed documents
- Legacy vs current parser badge

---

## Part 3 — Regression Test Suite (P0)

### 3A. Expand `document-ingestion.test.ts`

Add test fixtures that simulate real corpus patterns (not just toy strings):
- A governance doc structure (headings: POLITIQUE, PRINCIPES, RÈGLES)
- A bible doc structure (PERSONNAGES, LIEUX, MONDE)
- A script structure (SCÈNE 1, INT. BUREAU - JOUR, dialogues)
- A one-pager structure (TITRE, LOGLINE, SYNOPSIS, PUBLIC CIBLE)

Each fixture verifies:
- Parser routing succeeds
- Extracted text is non-empty
- Title/synopsis/characters/locations/scenes are detected
- Entity count > 0
- Source hierarchy precedence is respected

### 3B. Parser contract tests

Add tests that verify the contract between parser output and downstream consumers:
- Parser output → entity extraction input format
- Entity extraction output → canonical field format
- Canonical field → UI summary card expectations
- Failed parser → UI shows failure (not green/success)

---

## Part 4 — Runbooks Expansion (P1)

### 4A. Rewrite `docs/runbooks.md`

Expand from 7 to 14 runbooks. Add:
- **DOCX parsing failure** — symptoms, inspect extraction_mode/metadata, check storage_path exists, reprocess action
- **PDF parsing failure** — Vision API errors, base64 encoding issues, file corruption
- **Legacy parser migration** — how to identify, how to batch reprocess, what to verify after
- **Zero-entity extraction** — parser succeeded but AI returned nothing, check chunk quality
- **Classification failure** — wrong document_role assigned, how to override
- **Active result vs stale mismatch** — latest_successful_run diverges from displayed data
- **Export pipeline failure** — stitch-render errors, render status stuck

Each runbook: symptoms → probable causes → where to inspect → what to query → how to resolve → resolved criteria.

---

## Part 5 — Repository Documentation Overhaul (P1)

### 5A. Full README rewrite

The current README is already decent (470 lines) and covers most subsystems. The key gaps:
- **Ingestion subsystem** is described at high level but lacks parser versioning, migration, and active/history model
- **Timeline Studio** section is minimal — needs the NLE features (thumbnails, playhead, clip drawer, export wiring)
- **Observability** section is missing entirely
- **Go-live criteria** missing
- **Hybrid video** pipeline is documented but could be clearer

Rewrite to add:
1. Parser versioning & migration lifecycle section
2. Observability & diagnostics section
3. Active result vs history model explanation
4. Timeline Studio NLE capabilities
5. Go-live criteria checklist
6. Issue/milestone structure reference

### 5B. New doc files

Create:
- `docs/parser-versioning.md` — parser version contract, legacy detection, migration flow
- `docs/observability.md` — diagnostic_events, audit_logs, client-log, ingestion diagnostics
- `docs/go-live-criteria.md` — explicit checklist of what must be true before production
- `docs/timeline-studio.md` — NLE architecture, clip data flow, export pipeline

### 5C. Update `docs/architecture.md`

Still says "plateforme SaaS de production de séries premium" — must say "plateforme SaaS de production audiovisuelle multi-format (séries, films, clips musicaux, vidéo hybride)".

### 5D. Update `docs/document-ingestion.md`

Add parser versioning, active/history model, reprocess flow, diagnostic events.

---

## Part 6 — Frontend/Backend Contract Hardening (P1)

### 6A. ExtractionSummary: use `parser_version` column

Instead of guessing legacy status from `extraction_mode` string matching, use the new `parser_version` column. Show parser version badge per document in diagnostics.

### 6B. Success state validation

In `ExtractionSummary`, never show green/success (CheckCircle2) when `latest_successful_run` is null or when the active extraction_mode contains "failed". The current logic (`totalEntities > 0`) can be misleading if entities are from a stale run.

### 6C. ProjectBrainSummary dashboard widget

Add a `ProjectBrainCard` component to `ProjectView` that shows the coverage score, document counts, and a "Reprocess Legacy" button if legacy docs exist.

---

## Part 7 — Go-Live Criteria Document (P1)

Create `docs/go-live-criteria.md` with explicit gates:

| Gate | Criteria | Status |
|------|----------|--------|
| DOCX parsing | Stable on real corpus patterns | To verify |
| Legacy migration | Reprocess action works end-to-end | To verify |
| Active truth | No stale failed result shown as current | To implement |
| Ingestion summary | Trustworthy entity counts and coverage | Implemented |
| Extraction pipeline | Title/synopsis/characters/scenes on real corpus | To verify |
| Review gates | Auto-approve + manual fallback working | Implemented |
| Timeline | Clip persistence with source_url | Implemented |
| Export | stitch-render callable from Studio | Implemented |
| Diagnostics | Parser version visible, failure reasons visible | To implement |
| README | Aligned with actual platform | To update |
| Runbooks | Core failure classes documented | To expand |

---

## Execution Order

### P0 (blocks production)
1. DB migration: add `parser_version`, `latest_successful_run` to `source_documents`
2. `import-document`: persist parser_version, latest_successful_run, diagnostic_events
3. Regression tests: real corpus pattern fixtures
4. Verify reprocess works end-to-end

### P1 (blocks launch confidence)
5. Runbooks expansion (14 runbooks)
6. ExtractionSummary + ProjectBrainCard contract hardening
7. README + docs overhaul (parser-versioning, observability, go-live-criteria, timeline-studio)
8. architecture.md + document-ingestion.md updates

### Estimated scope
- 1 database migration (2 columns on `source_documents`)
- 1 edge function modified (`import-document`)
- 2 frontend components modified (`ExtractionSummary`, `DiagnosticsPanel`)
- 1 new frontend component (`ProjectBrainCard`)
- 1 test file expanded (`document-ingestion.test.ts`)
- 4 new doc files + 3 existing docs updated
- README rewritten

