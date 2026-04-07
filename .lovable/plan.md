
# Production Studio — Master Plan

## Phase 1–6: Core Platform ✅
## Phase 7: Production Robustness, QC & Cost Governance ✅
## Phase 8: Platform Governance Layer ✅

## Phase 9: Anti-Aberrations Validation Layer ✅

### Database:
- **aberration_categories** — 33 seeded categories across 9 groups (anatomy, object, temporal, physics, semantic, identity, framing, text_graphic, audio)
- **asset_validations** — Per-asset validation with multi-dimensional scores, blocking flags, pass results
- **anomaly_events** — Individual anomaly detections linked to validations with severity, confidence, explanation, suggested_fix
- **repair_attempts** — Tracks repair actions with attempt numbering and result status
- **repair_policies** — 9 seeded default repair actions per category with max retries and escalation
- **project_validation_reports** — Project-level sweep results with premium readiness score

### Engine:
- **`src/lib/aberration-taxonomy.ts`** — Type-safe taxonomy, severity weights, score computation, status derivation
- **`src/lib/validation-engine.ts`** — Multi-pass validation orchestrator, requestValidation(), isAssetCleared(), getProjectAnomalySummary()
- **`src/lib/repair-router.ts`** — Repair decision logic with retry tracking and escalation

### Edge Function:
- **`supabase/functions/validate-asset/index.ts`** — AI-powered validation using Gemini multimodal via Lovable AI. Analyzes images against prompts/scripts, produces structured scores and anomaly events via tool calling.

### Hooks:
- useAssetValidations, useAssetValidation, useAnomalyEvents, useProjectAnomalyEvents
- useRepairAttempts, useProjectValidationReport, useAberrationCategories, useRequestValidation

### UI:
- **ValidationBadge** — Status badge (pending/running/passed/failed/blocked)
- **AnomalyDetailsDrawer** — Slide-out panel with anomaly list, severity, repair buttons
- **ProjectValidationPanel** — Project-level summary: pass/fail/blocked counts, premium readiness score bar
- Wired as "Anti-Aberrations" tab in TimelineStudio
