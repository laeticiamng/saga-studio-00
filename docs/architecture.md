# Architecture — Saga Studio

## Vue d'ensemble

Saga Studio est une plateforme SaaS de production de séries premium assistée par IA. L'architecture suit un pattern serverless avec Supabase comme backend.

## Couches

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (React)                    │
│  Pages → Hooks → Supabase Client → Edge Functions    │
├─────────────────────────────────────────────────────┤
│               Edge Functions (Deno)                   │
│  Orchestration │ Agents │ Gates │ Delivery │ Admin    │
├─────────────────────────────────────────────────────┤
│               Supabase (PostgreSQL)                   │
│  Tables │ RLS │ Functions │ Triggers │ Storage        │
├─────────────────────────────────────────────────────┤
│               Services externes                       │
│  AI Gateway │ Stripe │ Storage │ SMTP                 │
└─────────────────────────────────────────────────────┘
```

## Base de données

### Schéma principal

37+ tables organisées en domaines :
- **Core** : projects, profiles, user_roles, credit_wallets, credit_ledger
- **Série** : series, seasons, episodes, scenes, scripts, script_versions
- **Bible** : bibles, character_profiles, character_reference_packs
- **Agents** : agent_registry, agent_prompts, agent_runs, agent_outputs
- **Workflow** : workflow_templates, workflow_runs, workflow_steps, workflow_step_runs
- **Approbation** : approval_steps, approval_decisions, workflow_approvals
- **Confiance** : workflow_confidence_scores
- **Continuité** : continuity_reports, continuity_memory_nodes, continuity_memory_edges, continuity_conflicts
- **Reviews** : psychology_reviews, legal_ethics_reviews, brand_safety_flags
- **Compliance** : redaction_profiles, redaction_rules, redaction_runs, redaction_reports
- **Livraison** : delivery_manifests, qc_reports, export_jobs, render_batches, asset_packs
- **Système** : feature_flags, audit_logs, job_queue, provider_registry, provider_capabilities, provider_failures

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

## Sécurité

- JWT validation dans chaque edge function
- Service role key jamais exposée côté client
- CORS headers sur toutes les edge functions
- Rate limiting (3 req/min) sur create-series
- Feature flags pour fonctionnalités en développement
