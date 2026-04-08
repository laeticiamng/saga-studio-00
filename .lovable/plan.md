

# Remaining Adjustments: Frontend Contract Hardening & Doc Updates

## What remains from the execution master plan

The database migration, edge function updates, regression tests, runbooks, and new docs were implemented. What's still missing:

1. **ExtractionSummary** still uses string-matching for legacy detection instead of the `parser_version` column
2. **DiagnosticsPanel** doesn't show `ingestion` scope events
3. **ProjectBrainCard** is created but never wired into any page
4. **document-ingestion.md** lacks parser versioning, active/history model, and diagnostic events sections

---

## Changes

### 1. Update ExtractionSummary to use `parser_version`

**File**: `src/components/create/ExtractionSummary.tsx`

- Add `parserVersion?: string` to `DocumentDiagnostic` interface
- Replace the `isLegacyDoc` function (lines 71-75) to check `d.parserVersion === 'legacy'` instead of string-matching on `extractionMode`
- Add parser version badge per document in the diagnostics list
- Fix success state: show green only when `parserVersion` is not `'legacy'` AND entities > 0

### 2. Add `ingestion` scope to DiagnosticsPanel

**File**: `src/components/studio/DiagnosticsPanel.tsx`

- Add `ingestion` to `SCOPE_LABELS` map and `scopes` array
- This enables viewing parser diagnostics (parser_selected, parser_completed, parser_failed, extraction_completed events)

### 3. Wire ProjectBrainCard into ProjectView

**File**: `src/pages/ProjectView.tsx`

- Import `ProjectBrainCard` from `@/components/studio/ProjectBrainCard`
- Add a brain data query (call `import-document` with `project_brain_summary` action)
- Add a legacy doc count query (count documents where `parser_version = 'legacy'`)
- Render `ProjectBrainCard` in the project overview tab

### 4. Update document-ingestion.md

**File**: `docs/document-ingestion.md`

Add three new sections:
- **Parser Versioning**: reference to `parser_version` column, version values, link to `docs/parser-versioning.md`
- **Active Result vs History**: explain `latest_successful_run`, `run_history`, how reprocess works
- **Diagnostic Events**: list ingestion-scope events emitted by `import-document`

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/create/ExtractionSummary.tsx` | Use `parserVersion` field, fix legacy detection, add version badge |
| `src/components/studio/DiagnosticsPanel.tsx` | Add `ingestion` scope |
| `src/pages/ProjectView.tsx` | Wire in ProjectBrainCard with brain data + legacy count queries |
| `docs/document-ingestion.md` | Add parser versioning, active/history, diagnostics sections |

