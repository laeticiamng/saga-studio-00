# Architecture Roadmap — Phases 2 & 3

> Suite de `architecture-review.md`. Phase 1 = livrée. Phase 2 et 3 = backlog priorisé.

## Phase 2 — P1 structurants (Mois 2-3)

### P1.1 — Stale-gate trigger DB *(B2)*
Trigger sur `scripts`, `scenes`, `timelines` qui marque automatiquement les `review_gates` aval comme `stale`. Vue `active_gates` excluant les stale.

### P1.2 — Policy engine shadow → enforce *(B3)*
Exploiter `governance_policies.enforcement_mode` (3 modes : off / shadow / enforce). Mode shadow = log violation sans bloquer. UI admin pour basculer par policy.

### P1.3 — Idempotence stricte *(A4)*
- `idempotency_key` requis pour tout débit crédit
- Index unique partiel sur `(idempotency_key, ref_type)` dans `credit_ledger`
- Helper Deno `withIdempotency(key, fn)` réutilisable

### P1.4 — Auto-chaining circuit breaker *(A2)*
Ajouter `chain_depth` dans le payload `episode-pipeline`. Refuse 422 + incident si > 20. Backoff exponentiel sur retry edge→edge.

### P1.5 — Provenance UI *(C3)*
Composant `<ProvenanceBadge field="title" recordId={id} table="series" />` qui affiche tooltip : "Extrait de doc X, page Y, confiance Z%". Câblé sur tous les champs auto-remplis.

### P1.6 — Canonical schema versionné *(C2)*
Table `canonical_field_schemas` avec validation JSON Schema. `import-document` valide à l'écriture. Drift de nommage (`protagonist` vs `main_character`) bloqué.

### P1.7 — DLQ explicite *(A3)*
Vue `dead_letter_jobs` (failed + non rejouable + >24h). Actions admin : Replay / Discard / Escalate to incident.

### P1.8 — Rate limiting structurel *(D4)*
Table `rate_limit_buckets` (token bucket par user+endpoint). Helper Deno appliqué à `autopilot-run`, `generate-shots`, `batch-render`.

## Phase 3 — P2 long terme (Mois 4-6)

### P2.1 — Tracing distribué *(A5)*
Propagation `correlation_id` end-to-end + page de visualisation timeline d'un run.

### P2.2 — QC archivé requêtable *(B4)*
Dénormalisation rapport QC dans `delivery_manifests.qc_summary` (jsonb).

### P2.3 — Réconciliation auto conflits canoniques *(C4)*
Agent dédié + règles configurables (most_recent / highest_confidence / source_priority).

### P2.4 — Chunked upload >20 Mo *(C5)*
`tus.io` ou multipart Supabase Storage.

### P2.5 — Boot-time secrets validator *(D5)*
`system-health` enrichi : valide la présence de tous les secrets requis avant d'accepter du trafic.

### P2.6 — Marketplace agents
Registre versionné + sandboxing. Hors-scope court terme.

## Critères de bascule Phase 1 → Phase 2

- Score santé ≥ 80 maintenu pendant 14 jours
- Ratio docs legacy < 10%
- Trigger budget basculé en `enforce` sans incident
- Reaper opérationnel en cron (pas seulement manuel)
