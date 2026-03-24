# Agents IA — Registre et configuration

## Vue d'ensemble

Saga Studio utilise 23 agents IA spécialisés organisés en 6 catégories. Chaque agent a un rôle précis dans le pipeline de production.

## Catégories

### Writing (Écriture)
| Agent | Slug | Rôle | Dépendances |
|-------|------|------|-------------|
| Showrunner | `showrunner` | Orchestrateur | — |
| Architecte narratif | `story_architect` | Créateur | — |
| Scénariste | `scriptwriter` | Créateur | story_architect |
| Coach dialogues | `dialogue_coach` | Affineur | scriptwriter |
| Script Doctor | `script_doctor` | Affineur | scriptwriter |

### Validation (Revue)
| Agent | Slug | Rôle | Dépendances |
|-------|------|------|-------------|
| Psychologue narratif | `psychology_reviewer` | Revieweur | scriptwriter |
| Conseiller juridique | `legal_ethics_reviewer` | Revieweur | scriptwriter |
| Vérificateur continuité | `continuity_checker` | Revieweur | scriptwriter |
| Contrôleur qualité | `qa_reviewer` | Revieweur | editor |
| Directeur casting | `casting_consistency` | Revieweur | visual_director |

### Visual (Visuel)
| Agent | Slug | Rôle | Dépendances |
|-------|------|------|-------------|
| Directeur visuel | `visual_director` | Créateur | story_architect |
| Concepteur de scènes | `scene_designer` | Créateur | scriptwriter, visual_director |
| Chef décorateur | `production_designer` | Créateur | visual_director |
| Costumier | `costume_designer` | Créateur | visual_director, continuity_checker |
| Accessoiriste | `props_designer` | Créateur | scene_designer |
| Étalonneur | `colorist` | Affineur | editor |

### Audio
| Agent | Slug | Rôle | Dépendances |
|-------|------|------|-------------|
| Directeur musical | `music_director` | Créateur | story_architect |
| Directeur voix | `voice_director` | Créateur | dialogue_coach |
| Ingénieur son | `sound_music` | Créateur | music_director |

### Production
| Agent | Slug | Rôle | Dépendances |
|-------|------|------|-------------|
| Planificateur de plans | `shot_planner` | Créateur | scene_designer |
| Monteur | `editor` | Assembleur | shot_planner |

### Delivery (Livraison)
| Agent | Slug | Rôle | Dépendances |
|-------|------|------|-------------|
| Responsable livraison | `delivery_manager` | Assembleur | qa_reviewer |
| Superviseur livraison | `delivery_supervisor` | Revieweur | delivery_manager, qa_reviewer |

## Configuration d'un agent

Chaque agent a dans sa `config` JSONB :
- `inputs` : données requises en entrée
- `outputs` : artefacts produits
- `success_criteria` : critère de succès
- `approval_required` : nécessite une approbation humaine
- `confidence_min` : seuil minimum de confiance
- `ui_visible` : visible dans le dashboard

## Prompts versionnés

Les prompts sont stockés dans `agent_prompts` avec :
- `agent_slug` : référence à l'agent
- `version` : numéro de version
- `content` : template du prompt (avec `{{input}}` et `{{context}}`)
- `is_active` : seul le prompt actif est utilisé

## Contexte fourni aux agents

Chaque agent reçoit :
1. Le contenu de l'épisode courant
2. Les profils des personnages de la série
3. Les bibles de la série
4. La mémoire de continuité (nodes actifs)
5. L'input spécifique à la tâche

## Sortie attendue

Tous les agents doivent retourner un JSON avec :
- `result` : le résultat principal
- `confidence` : score de confiance (0-1)
- `issues` : liste des problèmes trouvés
- `recommendations` : liste des suggestions
