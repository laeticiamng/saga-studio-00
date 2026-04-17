# Architecture Roadmap — Phases 2 & 3

> Suite de `architecture-review.md`. Phase 1 = livrée. Phase 2 = livrée. Phase 3 = backlog.

## Phase 2 — P1 structurants ✅ LIVRÉE

### P2.1 — Stale-gate triggers DB ✅
Triggers `trg_scripts_stale_gates`, `trg_scenes_stale_gates`, `trg_timelines_stale_gates` qui marquent les `review_gates` aval comme `stale = true` automatiquement. Vue `active_review_gates` filtrant les périmées.

### P2.2 — Idempotence stricte crédits ✅
Index unique partiel `uniq_credit_ledger_idem` sur `(ref_id, ref_type)` pour `delta < 0`. Tout double débit avec mêmes refs lèvera une violation.

### P2.3 — DLQ explicite ✅
Vue `dead_letter_jobs` (agents + exports failed >24h, retries épuisés). Edge function `dlq-actions` (admin-only) avec actions Replay / Discard / Escalate. Composant `<DLQPanel>` dans `/admin/architecture-health`.

### P2.4 — Rate limiting structurel ✅
Table `rate_limit_buckets` + fonction `consume_rate_limit` (token bucket). Helper `supabase/functions/_shared/rate-limit.ts` réutilisable (`checkRateLimit`, `rateLimitResponse`). À câbler dans `autopilot-run`, `generate-shots`, `batch-render` au prochain passage.

### P2.5 — Canonical schema versionné ✅
Table `canonical_field_schemas` + 5 schémas seed (title, synopsis, genre, tone, protagonist). RLS : lecture authentifiée, écriture admin.

### P2.6 — Circuit breaker auto-chaining ✅
Colonne `agent_runs.chain_depth`. `episode-pipeline` refuse 422 si `chain_depth > 20` + incident `chain_depth_exceeded`. Propagation `+1` à chaque appel `run-agent`. Vue admin "Deep chains" (depth > 10).

### P2.7 — Policy engine shadow → enforce ✅
Fonction `set_policy_enforcement(policy_key, mode)` admin-only avec audit log. Composant `<PolicyModeSwitch>` dans le dashboard pour basculer en un clic off / shadow / enforce.

### P2.8 — Provenance UI ✅
Composant `<ProvenanceBadge projectId fieldKey entityType />` qui affiche tooltip "Extrait de doc X, confiance Y%, état (validé / inféré / en attente)". Câblable sur tout champ auto-rempli.

## Phase 3 — Maturité opérationnelle ✅ LIVRÉE

### P3.1 — Tracing distribué ✅
Colonne `correlation_id` sur `agent_runs`, `audit_logs`, `diagnostic_events`, `incidents`, `workflow_steps` (+ index partiels). Helper `_shared/correlation.ts` (`getOrCreateCorrelationId`, header `x-correlation-id`). Page admin `/admin/trace/:correlationId` — timeline chronologique d'un run end-to-end.

### P3.2 — QC archivé requêtable ✅
Colonne `delivery_manifests.qc_summary` (jsonb) + trigger `denormalize_qc_on_completion`. Vue `qc_pass_rate_by_week` pour reporting hebdomadaire.

### P3.3 — Réconciliation auto conflits canoniques ✅
Tables `conflict_resolution_rules` + `conflict_resolution_log` (5 règles seed). Edge function `resolve-canonical-conflicts` schedulée toutes les 15 min via pg_cron. UI admin `<ConflictRulesPanel>` (changement de stratégie + log).

### P3.4 — Chunked upload >20 Mo ⏳ REPORTÉ
Multipart Supabase Storage non livré — sujet à reprendre Phase 4.

### P3.5 — Boot-time secrets validator ✅
`architecture-health` enrichi : check de 13 secrets (4 requis : SUPABASE_URL, SERVICE_ROLE_KEY, ANON_KEY, LOVABLE_API_KEY). Pénalité dure -25 sur health score si secret requis manquant. UI `<SecretsReadinessCard>`.

### P3.6 — Rate-limit câblé ✅ (partiel)
`autopilot-run` 10/min, `batch-render` 5/min via `_shared/rate-limit.ts`. `generate-shots` à câbler — son entrypoint actuel n'authentifie pas par JWT user.

### P3.7 — Validation JSON Schema à l'ingestion ✅
`import-document` charge `canonical_field_schemas` actifs et valide chaque entité. Drift → diagnostic `schema_drift_detected` + champ rejeté. Helper `_shared/json-schema.ts` (subset Ajv-like, sans dépendance npm).

### P3.8 — Marketplace agents ❌ HORS SCOPE
Sandboxing runtime trop coûteux — reporté.

## Cron actifs
- `reaper-every-5min` (Phase 1)
- `process-email-queue-every-min`
- `resolve-canonical-conflicts-15min` (Phase 3) ✨

## Critères de succès Phase 3
- 100% des runs autopilot ont un `correlation_id` propagé ✅
- 0 drift schema toléré silencieusement ✅
- Stratégie de résolution configurable par champ ✅
- Edge functions critiques (autopilot, batch-render) protégées ✅
- Health score pénalisé si secret manquant ✅

