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

## Phase 3 — P2 long terme (Mois 4-6)

### P3.1 — Tracing distribué *(A5)*
Propagation `correlation_id` end-to-end + page de visualisation timeline d'un run.

### P3.2 — QC archivé requêtable *(B4)*
Dénormalisation rapport QC dans `delivery_manifests.qc_summary` (jsonb).

### P3.3 — Réconciliation auto conflits canoniques *(C4)*
Agent dédié + règles configurables (most_recent / highest_confidence / source_priority).

### P3.4 — Chunked upload >20 Mo *(C5)*
`tus.io` ou multipart Supabase Storage.

### P3.5 — Boot-time secrets validator *(D5)*
`system-health` enrichi : valide la présence de tous les secrets requis avant d'accepter du trafic.

### P3.6 — Câblage rate-limit sur edge functions critiques
Appliquer `checkRateLimit` à `autopilot-run` (10/min), `generate-shots` (30/min), `batch-render` (5/min).

### P3.7 — Validation JSON Schema à l'ingestion
`import-document` valide chaque canonical field contre `canonical_field_schemas`. Drift bloqué.

### P3.8 — Marketplace agents
Registre versionné + sandboxing. Hors-scope court terme.

## Critères de bascule Phase 2 → Phase 3

- Score santé ≥ 85 maintenu pendant 14 jours
- 0 chaînage profond > 15 sur 7 jours
- DLQ < 3 jobs en moyenne
- Au moins 2 policies basculées en `enforce` sans incident
- Idempotence ledger : 0 violation `uniq_credit_ledger_idem` détectée
