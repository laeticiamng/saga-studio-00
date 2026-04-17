# Architecture Review — Saga Studio (Phase 1)

> Version : 1.0 · Date : 2026-04-17 · Auteur : Audit interne

## 1. Résumé exécutif

Plateforme structurellement saine (RLS systématique, machine d'état, provider matrix modulaire, ingestion canonique avec provenance), mais 5 dettes critiques bloquent un Go-Live serein :

1. **Pas de reaper** → jobs zombies indéfinis (constaté : 1 workflow >1h, 2 agents queued)
2. **Auto-chaining sans circuit breaker** → risque de boucle infinie + explosion coûts
3. **Budget projet non bloquant** → débits possibles au-delà du plafond
4. **74% des documents en parser legacy** → brain projet pollué, génération dégradée
5. **Visibilité aveugle** : 0 incidents/violations en 7j alors que des jobs sont stuck — les détecteurs ne détectent pas

Ces 5 points sont adressés en **Phase 1** (cette livraison). Phases 2 et 3 documentées dans `architecture-roadmap.md`.

## 2. État mesuré (Day 0)

| Indicateur | Valeur | Statut |
|---|---|---|
| Projets / épisodes | 8 / 10 | Trafic faible — fenêtre idéale |
| Documents legacy | 67 / 91 (74%) | 🔴 |
| Workflow runs `running` >1h | 1 | 🔴 |
| Agent runs `queued` >15 min | 2 | 🟡 |
| Tables sans RLS | 0 | ✅ |
| Incidents / violations 7j | 0 / 0 | 🟡 (faux silence) |

## 3. Forces préservées

- Modèle "Active Result vs History" + `parser_version` versionné
- Provider Matrix (`src/config/providers/`) avec résolveur déterministe et logs de décision
- RLS systématique + `has_role` security definer
- Machine d'état pipeline + gates d'approbation + scoring de confiance
- Ingestion canonique : `canonical_fields` + `field_provenance` + `canonical_conflicts`

## 4. Dettes par axe

### A. Pipeline & orchestration
- A1 🔴 Reaper absent → **résolu Phase 1**
- A2 🔴 Auto-chaining sans circuit breaker → P0 (chain_depth ≤ 20, à câbler dans `episode-pipeline`)
- A3 🟠 DLQ implicite — Phase 2
- A4 🟠 Idempotence partielle (idempotency_key existe mais non vérifié systématiquement) — Phase 2
- A5 🟡 Tracing distribué incomplet — Phase 3

### B. Gouvernance & qualité
- B1 🔴 Visibilité aveugle → **résolu Phase 1** via `architecture_health_snapshot` + dashboard
- B2 🟠 Stale-gate sans trigger DB — Phase 2
- B3 🟠 Policy engine sans mode shadow→enforce — Phase 2 (table `governance_policies.enforcement_mode` déjà présente)
- B4 🟡 QC non archivé requêtable — Phase 3
- B5 🟠 Invariants SQL absents → **résolu Phase 1** (tables `forbidden_transitions` + triggers)

### C. Données & ingestion
- C1 🔴 74% docs legacy → **résolu Phase 1** (alerte UI + edge function batch)
- C2 🟠 Schéma canonical libre — Phase 2
- C3 🟠 Provenance non visible utilisateur — Phase 2 (composant `<ProvenanceBadge>`)
- C4 🟡 Conflits 100% manuels — Phase 3
- C5 🟡 Pas de chunked upload >20Mo — Phase 3

### D. Sécurité & coûts
- D1 🔴 Budget projet non bloquant → **résolu Phase 1** (table `budget_violations` + mode shadow→enforce)
- D2 🟠 Scoping JWT/service_role flou — Phase 2
- D3 🟡 Index audit_logs partiel → **résolu Phase 1** (index `idx_audit_logs_correlation`)
- D4 🟠 Pas de rate-limiting structurel — Phase 2
- D5 🟡 Validation secrets au boot absente — Phase 3

## 5. Livraisons Phase 1

### Migrations DB
- Table `reaper_runs` (audit des passages reaper)
- Table `budget_violations` (log shadow + enforce)
- Table `forbidden_transitions` (règles configurables) + 4 règles initiales
- Triggers `enforce_delivery_manifest_transitions`, `enforce_export_version_completion`
- Vue `architecture_health_snapshot` (12 indicateurs temps réel, security_invoker)
- Index `idx_audit_logs_correlation`
- Colonne `project_budgets.enforcement_mode` (off/shadow/enforce)

### Edge Functions
- `reaper` — détecte et marque les jobs zombies (cron-able, admin-only sinon)
- `architecture-health` — expose snapshot + breakdowns + score pondéré
- `reprocess-legacy-batch` — ré-analyse legacy par lots de 5 (dry_run + estimation)

### UI
- Page `/admin/architecture-health` (12 cartes invariants + 4 onglets détail)
- Composants `<InvariantCard>`, `<LegacyDocsAlert>`
- Lien depuis `/admin` (bouton mis en avant)

### Documentation
- `docs/architecture-review.md` (ce document)
- `docs/architecture-roadmap.md` (Phase 2 et 3 détaillées)

## 6. Score de santé pondéré

```
score = 100
       - jobs_zombies × 5  (cap 30)
       - 20 si docs_legacy_ratio > 50%
       - 10 si docs_legacy_ratio > 20%
       - 15 si errors_7d > 10
       - 10 si budget_blocks_7d > 0
       - 10 si docs_failed > 0

Cible Go-Live : ≥80
```

## 7. Critères de succès Phase 1

- 0 job zombie >30 min après 7 jours
- Ratio docs legacy < 10% après 14 jours
- 0 dépassement budget non détecté
- Dashboard health consulté hebdomadairement par admin
- Score santé ≥80 maintenu

## 8. Garde-fous d'activation

- Trigger budget : mode `shadow` 7 jours puis basculer `enforce` en SQL admin
- Reaper : seuils conservateurs (15 min agents normaux, 45 min agents lents listés, 2h workflows, 1h exports)
- Reprocess legacy batch : limit 5 par défaut, dry_run préalable pour estimer le coût

## 9. Cron Reaper (à configurer manuellement)

Déclencher `reaper` toutes les 5 minutes via Supabase scheduled functions ou un cron externe :

```bash
*/5 * * * * curl -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  https://zgqkfanldpstxjjvpaqz.supabase.co/functions/v1/reaper
```

Ou bouton manuel "Run Reaper" dans `/admin/architecture-health`.
