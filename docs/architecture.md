# Architecture — Saga Studio

## Vue d'ensemble

Saga Studio est une plateforme SaaS de production de séries premium assistée par IA. L'architecture suit un pattern serverless avec Lovable Cloud comme backend.

## Couches

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (React)                    │
│  Pages → Hooks → Supabase Client → Edge Functions    │
├─────────────────────────────────────────────────────┤
│               Edge Functions (Deno)                   │
│  Orchestration │ Agents │ Gates │ Delivery │ Admin    │
├─────────────────────────────────────────────────────┤
│               PostgreSQL (Lovable Cloud)              │
│  Tables │ RLS │ Functions │ Triggers │ Storage        │
├─────────────────────────────────────────────────────┤
│               Services externes                       │
│  AI Gateway │ Stripe │ Storage │ SMTP                 │
└─────────────────────────────────────────────────────┘
```

## Base de données

### Schéma principal

50+ tables organisées en domaines :

- **Core** : projects, profiles, user_roles, credit_wallets, credit_ledger
- **Série** : series, seasons, episodes, scenes, scripts, script_versions
- **Bible** : bibles, character_profiles, character_reference_packs
- **Agents** : agent_registry, agent_prompts, agent_runs, agent_outputs
- **Workflow** : workflow_runs, workflow_steps, workflow_step_runs
- **Approbation** : approval_steps, approval_decisions, workflow_approvals
- **Confiance** : workflow_confidence_scores
- **Continuité** : continuity_reports, continuity_memory_nodes, continuity_memory_edges, continuity_conflicts
- **Reviews** : psychology_reviews, legal_ethics_reviews, brand_safety_flags
- **Compliance** : redaction_profiles, redaction_rules, redaction_runs, redaction_reports
- **Livraison** : delivery_manifests, qc_reports, export_jobs, asset_packs
- **Documents** : source_documents, source_document_chunks, source_document_entities, source_document_mappings, source_document_autofill_runs, field_provenance
- **Système** : feature_flags, audit_logs, job_queue, provider_registry

### RLS (Row Level Security)

Toutes les tables ont RLS activé. Pattern standard :
- Les utilisateurs voient leurs propres données (via projects.user_id)
- Les admins voient tout (via has_role)
- Certaines tables sont publiques en lecture (feature_flags, agent_registry, provider_registry)

## Flux de données

### Création de série
```
User → CreateSeries page → useSeries hook → create-series edge function
  → projects.insert(type=series) → series.insert → seasons.insert(number=1)
  → debit_credits(5)
```

### Pipeline autopilot
```
User → AutopilotDashboard → autopilot-run
  → episodes.update(status=story_development)
  → episode-pipeline(episode_id)
    → workflow_runs.insert
    → workflow_steps.insert
    → agent_runs.insert (per agent)
    → run-agent.invoke (per agent)
      → AI Gateway call
      → agent_outputs.insert
      → specialized_reviews.insert
      → confidence_scores.insert
      → maybeAdvanceEpisode()
        → check approval gate
        → auto-approve if confidence >= threshold
        → OR wait for human approval
        → advance episode status
        → episode-pipeline(next_step) [auto-chain]
```

### Import documentaire
```
User → DocumentsCenter (drag & drop)
  → upload to source-documents bucket
  → import-document edge function
    → text extraction (native)
    → AI analysis (Gemini) → entity extraction
    → source_document_chunks.insert
    → source_document_entities.insert
    → source_document_mappings.insert (with confidence scores)
    → source_documents.update(status=mapped)
  → User reviews mappings (accept/reject per field)
  → Accepted fields populate: series, episodes, characters, bibles
  → field_provenance tracks every auto-filled value
```

### Delivery pipeline
```
episode-pipeline(delivery step)
  → delivery_manager agent
  → continuity-check → continuity_reports
  → redaction-pass → redaction_reports
  → delivery-qc → qc_reports + delivery_manifests
  → If all pass → delivery_manifests.status = qc_passed
  → If any fail → export BLOCKED
```

## Agents IA

23 agents spécialisés répartis en 6 catégories :
- **Writing** : showrunner, story_architect, scriptwriter, dialogue_coach, script_doctor
- **Validation** : psychology_reviewer, legal_ethics_reviewer, continuity_checker, qa_reviewer, casting_consistency
- **Visual** : visual_director, scene_designer, production_designer, costume_designer, props_designer, colorist
- **Audio** : music_director, voice_director, sound_music
- **Production** : shot_planner, editor
- **Delivery** : delivery_manager, delivery_supervisor
- **Document** : document_ingestion, autofill_mapper

Chaque agent :
1. Reçoit un contexte (épisode, personnages, bibles, mémoire de continuité)
2. Appelle l'AI Gateway Lovable
3. Retourne un JSON structuré (result, confidence, issues, recommendations)
4. Stocke dans agent_outputs + tables spécialisées
5. Contribue au score de confiance de l'étape

## Gates d'approbation

5 gates dans le pipeline :
| Gate | Seuil auto-approve | Agents |
|------|-------------------|--------|
| psychology_review | 85% | psychology_reviewer |
| legal_ethics_review | 90% | legal_ethics_reviewer |
| continuity_check | 90% | continuity_checker |
| shot_review | 80% | qa_reviewer |
| edit_review | 85% | qa_reviewer |

## Sécurité

- JWT validation dans chaque edge function
- Service role key jamais exposée côté client
- CORS headers sur toutes les edge functions
- Rate limiting (3 req/min) sur create-series
- Feature flags pour fonctionnalités en développement
- Audit logging complet avec correlation_id

## Observabilité

- `audit_logs` : toute action significative
- `workflow_confidence_scores` : scoring par étape et agent
- `agent_runs` : latence, tokens, modèle, retries
- `job_queue` : état des jobs asynchrones
- `provider_registry` : health status des providers
