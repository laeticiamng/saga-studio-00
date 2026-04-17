

Phase 1 et 2 livrées. Voici Phase 3 (P2 long terme) cadrée.

# Phase 3 — Maturité opérationnelle

## Objectifs
Atteindre un niveau "production-grade" sur 6 axes : traçabilité distribuée, validation stricte des données, automatisation des conflits, scalabilité ingestion, robustesse edge functions, observabilité boot-time.

## Lots de travail

### Lot A — Tracing distribué (P3.1)
- Colonne `correlation_id uuid` propagée sur `agent_runs`, `workflow_steps`, `audit_logs`, `diagnostic_events`, `incidents`
- Helper `getOrCreateCorrelationId(req)` dans `_shared/`
- Page `/admin/trace/:correlationId` : timeline chronologique d'un run end-to-end (agents → workflows → diagnostics → audit)

### Lot B — Validation JSON Schema à l'ingestion (P3.7)
- `import-document` valide chaque canonical field extrait contre `canonical_field_schemas` (déjà créée Phase 2)
- Drift bloqué → incident `schema_drift_detected` + champ rejeté
- UI : badge "schema_valid" sur les champs ingérés

### Lot C — Réconciliation auto conflits canoniques (P3.3)
- Table `conflict_resolution_rules` (per-field : `most_recent` | `highest_confidence` | `source_priority`)
- Edge function `resolve-canonical-conflicts` cron (15 min)
- UI admin : éditeur de règles + log des résolutions auto

### Lot D — Câblage rate-limit (P3.6)
- `autopilot-run` : 10/min/user
- `generate-shots` : 30/min/user
- `batch-render` : 5/min/user
- Réponse 429 avec `Retry-After` header

### Lot E — Boot-time secrets validator (P3.5)
- `system-health` enrichi : check présence des 13 secrets requis (LOVABLE_API_KEY, STRIPE_*, RUNWAY_*, etc.)
- Endpoint `/admin/architecture-health` : nouveau bloc "Secrets readiness"
- Alerte rouge si secret manquant en production

### Lot F — QC archivé requêtable (P3.2)
- Colonne `delivery_manifests.qc_summary jsonb` (dénormalisation)
- Trigger `denormalize_qc_on_completion` qui agrège les checks au moment du `completed`
- Vue `qc_pass_rate_by_week` pour reporting

### Lot G — Chunked upload >20 Mo (P3.4)
- Multipart Supabase Storage côté frontend
- `import-document` accepte un `upload_session_id` et reconstitue le fichier
- Progression UI granulaire (chunk-level)

## Livrables
- 1 migration DB (colonnes correlation_id, table conflict_resolution_rules, qc_summary, triggers)
- 4 nouvelles edge functions : `resolve-canonical-conflicts`, modifications `system-health`, modifications `import-document`, modifications `autopilot-run`/`generate-shots`/`batch-render`
- 2 nouvelles pages : `/admin/trace/:id`, ajouts au dashboard `/admin/architecture-health`
- `mem://infrastructure/distributed-tracing` (nouveau memory)
- Mise à jour `docs/architecture-roadmap.md` (Phase 3 → ✅)

## Critères de succès
- 100% des runs ont un correlation_id propagé
- 0 drift schema toléré silencieusement
- ≥ 70% des conflits canoniques résolus automatiquement
- Aucun edge function critique sans rate-limit
- Health score ≥ 90 maintenu 30 jours

## Hors-scope (reporté)
- Marketplace agents (P3.8) : nécessite un sandboxing runtime trop coûteux à court terme
- Multi-tenant strict : nécessite refonte RLS globale, sujet dédié

