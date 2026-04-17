---
name: Rate-limited cost endpoints
description: Endpoints couteux protégés par checkRateLimit (consume_rate_limit RPC token bucket)
type: feature
---
Endpoints à coût élevé protégés par `checkRateLimit` (token bucket via `consume_rate_limit` RPC, key = user_id ou pseudo-user) :

| Endpoint | Capacity | Refill/min | Clé |
|---|---|---|---|
| `autopilot-run` | 10 | 10 | user_id |
| `batch-render` | 5 | 5 | user_id |
| `generate-shots` | 60 | 30 | project.user_id |
| `enhance-synopsis` | 20 | 20 | user_id |
| `analyze-audio` | 10 | 10 | project.user_id |
| `plan-project` | 15 | 15 | user_id |
| `import-document:heavy` | 15 | 10 | user_id (actions extract/reprocess/batch_process/wizard_extract/apply_corpus) |
| `import-document:light` | 60 | 30 | user_id (autres actions write) |
| `run-agent` | 30 | 30 | episode_id ou series_id (anti-emballement chaîne) |

Actions readonly de `import-document` (`check_status`, `debug_document`, `project_brain_summary`, `retrieve_context`) sont exemptées.
Helper : `supabase/functions/_shared/rate-limit.ts` — fail-open sur erreur infra.
