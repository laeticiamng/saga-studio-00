# Saga Studio — AI Series Production Platform

Plateforme de production de séries premium assistée par IA. Saga Studio orchestre automatiquement la création d'épisodes via un pipeline multi-agents, de l'idée initiale à la livraison finale.

## Architecture

```
Utilisateur → CreateSeries → Autopilot → Pipeline 10 étapes
                                           ├── Story Development (story_architect, scriptwriter)
                                           ├── Psychology Review (psychology_reviewer) ← approval gate
                                           ├── Legal/Ethics Review (legal_ethics_reviewer) ← approval gate
                                           ├── Visual Bible (visual_director)
                                           ├── Continuity Check (continuity_checker) ← approval gate
                                           ├── Shot Generation (scene_designer, shot_planner)
                                           ├── Shot Review (qa_reviewer) ← approval gate
                                           ├── Assembly (editor)
                                           ├── Edit Review (qa_reviewer) ← approval gate
                                           └── Delivery (delivery_manager) → QC → Export
```

## Stack technique

| Couche | Technologie |
|--------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Backend | Supabase (PostgreSQL, Auth, Edge Functions, Storage) |
| IA | Gemini 2.5 Flash via Lovable AI Gateway |
| Tests | Vitest |
| Paiements | Stripe |

## Démarrage rapide

```bash
# 1. Cloner et installer
git clone <repo-url>
cd saga-studio-00
npm install

# 2. Configuration
cp .env.example .env
# Renseigner VITE_SUPABASE_* dans .env

# 3. Développement
npm run dev        # Serveur dev (port 8080)
npm run test       # Tests
npm run typecheck  # Vérification TypeScript
npm run ci         # typecheck + lint + tests
```

## Modèle de données

### Hiérarchie série
- `projects` (type=series) → `series` → `seasons` → `episodes` → `scenes`
- `scripts` → `script_versions` (1:1 avec episodes)
- `bibles` (8 types: style, character, wardrobe, location, world, music, voice, prop)
- `character_profiles` → `character_reference_packs`

### Orchestration
- `workflow_templates` → `workflow_runs` → `workflow_steps` → `workflow_step_runs`
- `workflow_approvals` (lien vers approval_steps)
- `workflow_confidence_scores` (scoring par dimension)

### Agents
- `agent_registry` (23 agents spécialisés)
- `agent_prompts` (prompts versionnés)
- `agent_runs` → `agent_outputs`

### Qualité / Compliance
- `approval_steps` → `approval_decisions`
- `continuity_reports`, `psychology_reviews`, `legal_ethics_reviews`
- `continuity_memory_nodes` → `continuity_memory_edges` → `continuity_conflicts`
- `brand_safety_flags`
- `redaction_profiles` → `redaction_rules` → `redaction_runs` → `redaction_reports`

### Livraison
- `delivery_manifests` → `qc_reports`
- `export_jobs`
- `render_batches`, `asset_packs`

## Pages UI

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/dashboard` | Vue d'ensemble des projets |
| CreateSeries | `/create/series` | Création d'une nouvelle série |
| SeriesView | `/series/:id` | Vue détaillée d'une série |
| EpisodeView | `/series/:id/episode/:episodeId` | Vue détaillée d'un épisode |
| AutopilotDashboard | `/series/:id/autopilot` | Timeline et contrôle du pipeline |
| ApprovalInbox | `/series/:id/approvals` | Approbation/rejet des étapes |
| ContinuityCenter | `/series/:id/continuity` | Graphe de mémoire et conflits |
| DeliveryCenter | `/series/:id/delivery` | QC, compliance et export |
| AgentDashboard | `/series/:id/agents` | Monitoring des agents IA |
| BibleManager | `/series/:id/bibles` | Gestion des bibles de production |
| CharacterGallery | `/series/:id/characters` | Galerie des personnages |

## Edge Functions

| Fonction | Description |
|----------|-------------|
| `create-series` | Crée un projet série avec saison 1 |
| `episode-pipeline` | Dispatche les agents pour une étape |
| `run-agent` | Exécute un agent IA avec retry et scoring |
| `autopilot-run` | Démarre le pipeline complet pour un épisode |
| `approval-evaluate` | Traite une décision humaine (approve/reject/revision) |
| `continuity-check` | Vérifie la cohérence inter-épisodes |
| `redaction-pass` | Vérifie la compliance avant export |
| `delivery-qc` | QC final avant livraison |
| `workflow-pause` | Met en pause un workflow |
| `workflow-resume` | Reprend un workflow pausé ou échoué |
| `workflow-cancel-safe` | Annule un workflow proprement |

## Tests

```bash
npm run test           # Tous les tests
npm run test:unit      # Tests unitaires (workflow, agents, gates, continuité)
npm run test:e2e       # Tests E2E pipeline
npm run typecheck      # Vérification types
npm run ci             # Suite CI complète
```

91 tests couvrent : pipeline, idempotency, retries, approval gates, confidence scoring, continuity, redaction, delivery blocking.

## Sécurité

- `.env` exclu du versioning (`.gitignore`)
- RLS (Row Level Security) activé sur toutes les tables
- Auth JWT validé dans chaque edge function
- Service role key uniquement dans les edge functions (jamais côté client)
- Rate limiting sur la création de séries
- Feature flags pour activer/désactiver les fonctionnalités

## Import documentaire

La plateforme permet d'importer un document source (PDF, DOCX, TXT, Markdown) pour pré-remplir automatiquement un projet. Le pipeline :

1. **Upload** → extraction texte natif
2. **Analyse IA** → extraction d'entités (personnages, lieux, épisodes, musique, etc.)
3. **Mapping** → correspondance vers les tables cibles avec score de confiance
4. **Revue** → validation champ par champ dans DocumentsCenter
5. **Propagation** → écriture dans séries, épisodes, bibles, personnages

Hiérarchie des sources : édition manuelle > document validé > document brut > suggestion IA.

## Documentation complémentaire

- [docs/architecture.md](docs/architecture.md) — Architecture détaillée
- [docs/autopilot.md](docs/autopilot.md) — Fonctionnement de l'autopilot
- [docs/agents.md](docs/agents.md) — Liste et configuration des agents
- [docs/continuity.md](docs/continuity.md) — Système de mémoire de continuité
- [docs/delivery.md](docs/delivery.md) — Pipeline de livraison
- [docs/security.md](docs/security.md) — Politique de sécurité
- [docs/runbooks.md](docs/runbooks.md) — Procédures opérationnelles
- [docs/document-ingestion.md](docs/document-ingestion.md) — Pipeline d'import documentaire
- [docs/autofill.md](docs/autofill.md) — Pré-remplissage intelligent
