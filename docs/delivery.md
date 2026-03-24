# Delivery — Pipeline de livraison

## Gates avant livraison

Avant qu'un épisode puisse être exporté, il doit passer 7 gates :

1. **Continuity Gate** : pas de conflits critiques dans le rapport de continuité
2. **Psychology Gate** : pas de blocage psychologique
3. **Legal/Ethics Gate** : pas de violation légale ou éthique
4. **Brand Safety Gate** : pas de flags critiques non résolus
5. **Completeness Gate** : script + scènes existent
6. **Confidence Gate** : score moyen >= 50%
7. **Redaction/Compliance Gate** : pas de problèmes bloquants

## Flux

```
Episode completed → delivery-qc (7 checks)
  → qc_reports.insert
  → delivery_manifests.upsert (status = qc_passed | qc_failed)
  → Si QC passed:
    → redaction-pass (compliance check)
    → export-assets (génération du package)
    → export_jobs.insert
```

## QC Report

Chaque rapport contient :
- `checks` : liste des vérifications avec status (pass/warn/fail)
- `overall_verdict` : pass | conditional_pass | fail
- `blocking_issues` : problèmes qui empêchent la livraison
- `warnings` : problèmes non bloquants
- `score` : score global (0-1)

## Export Types

- `video` : export vidéo MP4
- `audio` : export audio séparé
- `subtitles` : sous-titres
- `thumbnails` : vignettes
- `metadata` : métadonnées JSON
- `full_package` : package complet

## Delivery Manifest

Le manifest regroupe tous les assets d'un épisode :
- Status : draft → pending_qc → qc_passed/qc_failed → delivered → archived
- Assets : liste des fichiers avec URLs et métadonnées
- Metadata : résultats QC, checks détaillés

## UI

Le DeliveryCenter (`/series/:id/delivery`) permet de :
- Voir tous les manifestes de livraison
- Lancer un QC ou une vérification compliance
- Voir les checks détaillés
- Exporter les épisodes validés
- Suivre les export jobs en cours
