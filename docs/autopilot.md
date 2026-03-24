# Autopilot — Pipeline automatique

## Concept

L'autopilot exécute le pipeline de production complet d'un épisode avec un minimum d'intervention humaine. L'utilisateur démarre l'autopilot, valide les étapes critiques (si la confiance est insuffisante), et la plateforme enchaîne le reste.

## 10 étapes du pipeline

| # | Étape | Agents | Gate d'approbation | Seuil auto-approve |
|---|-------|--------|-------------------|-------------------|
| 1 | Story Development | story_architect, scriptwriter | Non | — |
| 2 | Psychology Review | psychology_reviewer | Oui | 85% |
| 3 | Legal/Ethics Review | legal_ethics_reviewer | Oui | 90% |
| 4 | Visual Bible | visual_director | Non | — |
| 5 | Continuity Check | continuity_checker | Oui | 90% |
| 6 | Shot Generation | scene_designer, shot_planner | Non | — |
| 7 | Shot Review | qa_reviewer | Oui | 80% |
| 8 | Assembly | editor | Non | — |
| 9 | Edit Review | qa_reviewer | Oui | 85% |
| 10 | Delivery | delivery_manager | Non | — |

## Progression automatique

Le pipeline s'auto-chaîne :
1. `episode-pipeline` dispatche les agents pour l'étape courante
2. `run-agent` exécute chaque agent et collecte les résultats
3. Quand tous les agents d'une étape sont terminés, `maybeAdvanceEpisode` évalue :
   - Si l'étape n'a pas de gate → avance automatiquement
   - Si l'étape a un gate et la confiance >= seuil → auto-approuve et avance
   - Si l'étape a un gate et la confiance < seuil → attend une décision humaine
4. L'avancement vers l'étape suivante redéclenche `episode-pipeline`

## Contrôles utilisateur

- **Démarrer** : lance l'autopilot depuis un épisode en status `draft`
- **Pause** : arrête le chaînage après l'étape en cours
- **Reprendre** : reprend depuis l'étape courante
- **Annuler** : annule les agents en attente, garde les résultats acquis
- **Relancer une étape** : re-dispatche les agents pour une étape spécifique

## Idempotency

Chaque agent_run a un `idempotency_key` unique basé sur `episodeId + status + agentSlug + workflowRunId`. Si le même agent est relancé pour la même étape, l'appel existant est retourné sans doublon.

## Retry policy

Si un agent échoue :
- Retry avec backoff exponentiel (1s, 2s, 4s)
- Maximum 3 tentatives
- Au-delà : le run passe en `failed` et le workflow s'arrête
- L'utilisateur peut relancer manuellement via workflow-resume

## Observabilité

Chaque étape produit :
- Un `workflow_step` avec status et timestamps
- Des `agent_runs` avec latence, tokens, modèle utilisé
- Des `workflow_confidence_scores` par dimension
- Des entrées dans `audit_logs` avec `correlation_id`
