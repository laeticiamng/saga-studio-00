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
