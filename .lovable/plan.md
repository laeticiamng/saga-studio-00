
# Anti-Aberrations Validation Layer

## Group A: Database Migration
1. **`aberration_categories`** — Taxonomy reference table (category, subcategory, severity_default, repair_action_default)
2. **`asset_validations`** — Per-asset validation record (asset_id, asset_type, validation_status, scores JSON, blocking, validator_type, explanation, pass_results JSON)
3. **`anomaly_events`** — Individual anomaly detections (validation_id, category, subcategory, severity, confidence, explanation, suggested_fix, auto_fix_attempted, auto_fix_result, blocking)
4. **`repair_attempts`** — Repair tracking (anomaly_event_id, repair_mode, provider_used, result_asset_id, status, attempt_number)
5. **`repair_policies`** — Default repair actions per anomaly category (category, default_action, max_retries, escalation_action)
6. **`project_validation_reports`** — Final project-level sweep results (project_id, timeline_version, total_anomalies, blocking_count, premium_readiness_score, report JSON)
7. **Seed** ~30 aberration categories across the 9 top-level groups (A-I)
8. **Seed** repair policies for each category

## Group B: Validation Engine
1. **`src/lib/aberration-taxonomy.ts`** — TypeScript types for all categories/subcategories
2. **`src/lib/validation-engine.ts`** — Multi-pass validation orchestrator: technical, visual, semantic, continuity, story, delivery passes. Scoring logic. Blocking rules.
3. **`src/lib/repair-router.ts`** — Repair decision logic: maps anomaly → repair action, tracks retry loops, escalation

## Group C: Edge Function
1. **`supabase/functions/validate-asset/index.ts`** — Server-side validation using multimodal AI (Gemini) to analyze images/videos against prompt, script, refs. Writes to asset_validations + anomaly_events.

## Group D: Hooks
1. **`useAssetValidations`** — Read validations for a project/asset
2. **`useAnomalyEvents`** — Read anomaly events
3. **`useRepairAttempts`** — Read/create repair attempts
4. **`useProjectValidationReport`** — Read final sweep report

## Group E: UI
1. **`ValidationBadge`** — Small badge showing validation status (pass/fail/pending)
2. **`AnomalyDetailsDrawer`** — Slide-out panel showing anomaly list with severity, explanation, repair options
3. **`ProjectValidationPanel`** — Project-level anomaly summary + premium-readiness score
4. Wire into TimelineStudio as a new tab

## Not in scope (future):
- Real-time frame-by-frame video analysis (requires external infra)
- Lip-sync detection (requires specialized model)
- Pre-generation prevention (prompt complexity analysis — planned but deferred to separate iteration)
