# Observability & Diagnostics

## Overview

Saga Studio has a multi-layer observability stack — all internal, no external services required.

## Layers

### 1. Diagnostic Events (`diagnostic_events` table)

Structured, human-readable events per project. Scopes:

| Scope | Usage |
|-------|-------|
| `project` | Project-level lifecycle events |
| `scene` | Scene generation events |
| `job` | Job queue events |
| `export` | Export/render events |
| `clip` | Clip generation events |
| `provider` | Provider health/failure events |
| `ingestion` | Document parsing & extraction events |

Each event has:
- `event_type` — machine-readable (e.g. `parser_completed`, `provider_fallback`)
- `severity` — `info`, `warning`, `error`, `critical`
- `title` — human-readable summary
- `detail` — extended description
- `raw_data` — structured JSON payload
- `scope_id` — reference to the specific entity

### 2. Audit Logs (`audit_logs` table)

Every significant user/system action:
- Document uploads, extractions, reprocessing
- Project creation, series creation
- Agent runs, approval decisions
- Credit transactions
- Admin actions

Includes `correlation_id` for tracing related operations.

### 3. Client-Side Logging (`client-log` edge function)

Browser errors and warnings sent to backend via debounced queue (5s / 10 logs). Persisted in `audit_logs` with `entity_type = 'client_error'`.

### 4. Agent Run Telemetry (`agent_runs` table)

Per-agent execution metrics:
- `latency_ms` — execution duration
- `tokens_used` — AI token consumption
- `model_used` — which model was called
- `retry_count` / `max_retries` — retry behavior
- `error_message` — failure details

### 5. Provider Health (`provider_registry` + `provider_failures`)

- `provider_registry.health_status` — current provider state
- `provider_failures` — recent failure events with error details
- `system-health` edge function — real-time API connectivity checks

## Ingestion-Specific Observability

### Parser Diagnostics

Every document extraction emits diagnostic events:

```
parser_selected → parser_completed / parser_failed → extraction_completed
```

Each event includes:
- `parser_version` — which version processed the document
- `extraction_method` — which parser was used (docx_xml_parse, pdf_vision_api, etc.)
- `text_length` — how much text was extracted
- `file_type`, `file_name` — document identification
- `duration_ms` — processing time
- `fallback_used` — whether a fallback parser was attempted

### Raw Extraction Preview

The `debug_document` action returns:
- `text_preview_500` / `text_preview_1000` — first N chars of extracted text
- `chunk_previews` — first 200 chars of each chunk
- `parser_debug` — low-level parser diagnostics (ZIP validity, XML length, etc.)

### Querying Diagnostics

```sql
-- All ingestion events for a project
SELECT * FROM diagnostic_events
WHERE project_id = '...' AND scope = 'ingestion'
ORDER BY created_at DESC;

-- Failed parsers in last 24h
SELECT * FROM diagnostic_events
WHERE scope = 'ingestion' AND event_type = 'parser_failed'
AND created_at > now() - interval '24 hours';

-- Legacy documents
SELECT id, file_name, parser_version, status
FROM source_documents
WHERE parser_version = 'legacy';
```

## Frontend Panels

- **DiagnosticsPanel** (`src/components/studio/DiagnosticsPanel.tsx`) — Tabbed view of all diagnostic events by scope
- **ProjectDiagnostics** (`src/components/ProjectDiagnostics.tsx`) — Project-level health overview
- **DocumentsCenter** — Per-document parser status, version badges, reprocess buttons
