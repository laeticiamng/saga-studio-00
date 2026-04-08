# Runbooks — Procédures opérationnelles

## 1. Épisode bloqué en status intermédiaire

**Symptôme** : un épisode reste en `psychology_review` ou autre status pendant longtemps.

**Diagnostic** :
1. Vérifier `workflow_runs` pour l'épisode → status devrait être `running`
2. Vérifier `workflow_steps` → l'étape courante est peut-être en `waiting_approval`
3. Vérifier `agent_runs` → des agents sont peut-être `failed` ou `queued`

**Résolution** :
- Si `waiting_approval` → aller dans ApprovalInbox et approuver/rejeter
- Si agents `failed` → utiliser `workflow-resume` pour relancer
- Si agents `queued` sans progression → vérifier les logs edge functions

## 2. Agent qui échoue systématiquement

**Symptôme** : un agent atteint `max_retries` et passe en `failed`.

**Diagnostic** :
1. Vérifier `agent_runs.error_message`
2. Vérifier les logs de l'edge function `run-agent`
3. Vérifier que le prompt est correct dans `agent_prompts`

**Résolution** :
- Si erreur AI gateway → vérifier la connectivité
- Si erreur de prompt → mettre à jour le prompt dans `agent_prompts`
- Relancer via `workflow-resume` avec le step approprié

## 3. Confiance trop basse pour auto-approve

**Symptôme** : le pipeline s'arrête car la confiance est sous le seuil.

**Options** :
1. Approuver manuellement via ApprovalInbox (si le contenu est acceptable)
2. Demander une révision (l'étape sera relancée avec de nouveaux agents)
3. Ajuster le seuil dans la config du workflow template

## 4. Conflits de continuité bloquants

**Symptôme** : le ContinuityCenter montre des conflits `critical` ou `error`.

**Résolution** :
1. Vérifier les conflits dans ContinuityCenter
2. Si faux positif → marquer comme résolu dans la base
3. Si vrai problème → demander une révision du script/scènes

## 5. QC échoué avant livraison

**Symptôme** : le delivery manifest est en `qc_failed`.

**Diagnostic** :
1. Aller dans DeliveryCenter
2. Voir les `blocking_issues` dans le QC report
3. Résoudre chaque issue (script manquant, scènes absentes, etc.)

**Résolution** :
1. Corriger les problèmes identifiés
2. Relancer le QC via le bouton "Relancer QC"

## 6. Jobs bloqués dans la queue

**Diagnostic** :
```sql
SELECT * FROM job_queue
WHERE status = 'processing'
AND started_at < now() - interval '30 minutes';
```

**Résolution** :
- Reset les jobs bloqués en `pending` pour retry
- Ou les passer en `failed` si le problème est permanent

## 7. Provider en panne

**Diagnostic** :
1. Vérifier AdminProviderDashboard → health status
2. Vérifier `provider_failures` pour les erreurs récentes

**Résolution** :
- Désactiver le provider dans `provider_registry`
- Le système basculera sur le fallback si configuré

## 8. DOCX parsing failure

**Symptôme** : un document DOCX affiche `docx_parse_failed` dans `extraction_mode`.

**Diagnostic** :
1. Vérifier `metadata.extraction_debug.parser_debug` pour le détail :
   - `zipValid: false` → le fichier n'est pas un vrai ZIP (peut-être un .doc renommé)
   - `entryFound: false` → word/document.xml absent dans le ZIP
   - `xmlLength < 50` → document vide
   - `error` contient le message exact
2. Utiliser `debug_document` pour re-tester l'extraction :
   ```
   POST /import-document { "action": "debug_document", "document_id": "..." }
   ```
3. Vérifier que le fichier existe dans `source-documents` bucket via `storage_path`

**Résolution** :
- Si fichier .doc (OLE2) → demander à l'utilisateur de convertir en .docx
- Si ZIP corrompu → demander un re-upload
- Si parseur OK mais 0 entités → vérifier la qualité du texte extrait
- Relancer : `POST /import-document { "action": "reprocess", "document_id": "..." }`

**Résolu quand** : `status = 'ready_for_review'` et `parser_version = '2.0.0'`

## 9. PDF parsing failure

**Symptôme** : `pdf_parse_failed` dans `extraction_mode`.

**Diagnostic** :
1. Vérifier les logs de `import-document` pour les erreurs Gemini Vision
2. Causes probables : PDF trop volumineux (>20 Mo), PDF protégé, PDF image-only sans OCR, erreur API

**Résolution** :
- Si fichier trop gros → découper en sections
- Si protégé → déprotéger avant upload
- Si erreur API temporaire → relancer via `reprocess`
- Vérifier que `LOVABLE_API_KEY` est configuré

**Résolu quand** : `status = 'ready_for_review'` et texte extrait non vide

## 10. Legacy parser migration

**Symptôme** : documents avec `parser_version = 'legacy'` ou `extraction_mode` contenant `pdf_vision_api`.

**Diagnostic** :
```sql
SELECT id, file_name, parser_version, extraction_mode, status
FROM source_documents
WHERE parser_version = 'legacy' OR parser_version IS NULL;
```

**Résolution** :
1. Ré-analyser un seul document : `POST /import-document { "action": "reprocess", "document_id": "..." }`
2. Ré-analyser tout un projet : `POST /import-document { "action": "reprocess_legacy", "project_id": "..." }`
3. Vérifier après : `parser_version` doit être `'2.0.0'`, `latest_successful_run` doit être non null

**Résolu quand** : aucun document avec `parser_version = 'legacy'` dans le projet

## 11. Zero-entity extraction

**Symptôme** : le parseur réussit (texte extrait > 20 chars) mais l'IA ne retourne aucune entité.

**Diagnostic** :
1. Vérifier `metadata.extraction_debug.ai_parser_status` — si `api_error_*` → erreur API
2. Vérifier la qualité du texte : `debug_document` → `text_preview_500`
3. Si le texte est du bruit (caractères spéciaux, formatage cassé) → le parseur a réussi techniquement mais le contenu est inutilisable

**Résolution** :
- Si erreur API → relancer via `reprocess`
- Si texte de mauvaise qualité → le document source est peut-être un scan sans OCR
- Si le texte est correct mais 0 entités → vérifier que le prompt AI couvre le type de document

**Résolu quand** : `entities_extracted > 0` dans `metadata.extraction_debug`

## 12. Classification failure

**Symptôme** : `document_role = 'unknown'` avec `role_confidence = 0`.

**Diagnostic** :
1. Vérifier le texte extrait — peut-être trop court ou trop générique
2. Le modèle AI n'a pas su classifier

**Résolution** :
- Modifier manuellement le rôle via DocumentsCenter (Select "Rôle du document")
- Ou relancer l'analyse via `reprocess`

## 13. Active result vs stale mismatch

**Symptôme** : l'UI affiche des entités d'une ancienne extraction alors que le document a été reprocessé.

**Diagnostic** :
1. Vérifier `latest_successful_run` — doit être non null avec `parser_version` récent
2. Vérifier que les anciennes entités ont été supprimées lors du reprocess
3. Vérifier `metadata.run_history` pour voir l'historique

**Résolution** :
- Si `latest_successful_run` est null → le reprocess n'a pas réussi, relancer
- Si les vieilles entités persistent → supprimer manuellement et relancer

**Résolu quand** : `latest_successful_run.parser_version` = version courante

## 14. Export pipeline failure

**Symptôme** : un export reste en `rendering` ou passe en `failed`.

**Diagnostic** :
1. Vérifier `export_versions` → `status`, `failure_stage`
2. Vérifier les logs de `stitch-render`
3. Vérifier que les clips ont des `source_url` valides (pas null)

**Résolution** :
- Si clips sans `source_url` → relancer `assemble-rough-cut` d'abord
- Si erreur render → vérifier les logs stitch-render
- Si timeout → le projet est peut-être trop long, découper

**Résolu quand** : `export_versions.status = 'completed'` avec `output_url` non null
