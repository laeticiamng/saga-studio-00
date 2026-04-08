

# Plan: Episode Data Autofill + Full Audit + README Update

## Summary

Three-part hardening: (1) Wire extracted episode data into series creation and every downstream step, (2) Audit all pipelines end-to-end for gaps, (3) Rewrite the README with complete governance documentation.

---

## Part 1 — Episode Data Preservation & Autofill

### Problem
When documents are imported, episode entities ARE extracted (title, number, synopsis, scenes, act_structure) and stored in `source_document_entities`. However:
- **`create-series`** creates blank "Épisode 1", "Épisode 2"... episodes — it never queries extracted episode entities to pre-fill titles, synopses, or scene counts
- **No post-creation autofill**: After series creation, there's no mechanism to apply extracted episode data to the existing `episodes` rows
- **Character profiles not auto-created**: Extracted `character` entities remain in `source_document_entities` but are never written to `character_profiles`
- **Bibles not auto-populated**: Extracted `location`, `visual_reference`, `mood` entities are not assembled into bible entries

### Fixes

**A. `create-series` edge function** — After episode rows are created, query `source_document_entities` for the project's extracted episodes and update each row with title, synopsis, and duration if available. Also auto-create `character_profiles` rows from extracted character entities. Also auto-create bible entries from extracted locations/world data.

**B. New `apply-corpus` action in `import-document`** — A callable action that takes a `project_id` and applies all confirmed/proposed entities to their target tables:
- `episode` entities → update matching `episodes` rows (by number) with title, synopsis
- `character` entities → upsert into `character_profiles`
- `location` entities → upsert into `bibles` (type='world')
- `scene` entities → insert into `scenes` if episode exists
- `continuity_rule` entities → insert into `continuity_memory_nodes`

**C. Frontend trigger** — In `SeriesView.tsx` or `DocumentsCenter`, after batch document processing completes, automatically invoke `apply-corpus` to propagate extracted data.

---

## Part 2 — Full Platform Audit (by pipeline step)

### Ingestion Pipeline
- **OK**: Document upload, classification, extraction, batching, conflict detection, missing info — all functional
- **Gap**: `wizard_extract` pre-fills episodes in the prefill response but never writes them to DB → Fix in Part 1B

### Series Creation
- **Gap**: Episodes created as blank shells → Fix in Part 1A
- **Gap**: No `quality_tier` propagated (fixed in prior audit, verify column exists)

### Episode Pipeline (Autopilot)
- **OK**: 10-step pipeline with agents, approval gates, auto-advance, idempotency
- **Gap**: `episode-pipeline` doesn't inject extracted episode-specific corpus data (synopsis, scenes from script) into agent `input` — agents only get duration estimates, not the actual extracted content for that episode
- **Fix**: In `episode-pipeline`, before dispatching agents, query `source_document_entities` for entities matching the episode number and inject them into the agent run's `input` field

### Agent Execution (`run-agent`)
- **OK**: Corpus context injection (canonical fields, entities, production directives) is comprehensive
- **OK**: Per-agent entity type mapping is well-designed
- **OK**: Specialized output writers (scenes, scripts, reviews) work correctly
- **Gap**: `showrunner` agent is defined in prompts but not used in any pipeline step
- **Note**: The showrunner should be the first agent in the pipeline to validate the overall direction — consider adding it

### Shot Generation (`generate-shots`)
- **OK**: Provider routing with priority chain, credit deduction, batch limits (5/invocation)
- **OK**: Corpus production directives injected into prompts
- **Gap**: `validate-asset` not called post-generation (identified in prior audit, verify it was wired)

### Assembly & Rendering
- **OK**: `assemble-rough-cut` and `stitch-render` handle timeline creation and beat-sync
- **OK**: Beat-sync engine in `stitch-render` properly aligns cuts to bars/beats

### Review Gates
- **OK**: Auto-approve thresholds, manual fallback, stale gate invalidation
- **OK**: Confidence scoring per agent dimension

### QC & Export
- **OK**: `delivery-qc` checks multiple dimensions
- **OK**: `export-assets` generates versioned outputs (verify `.eq("status", "completed")` filter was added)

### Governance
- **OK**: 18-state governance engine, policy checking, violation logging
- **Gap**: Governance state not synced with pipeline status (identified, implement reconciliation)

### Missing Cross-Cutting Concerns
1. **No episode-level synopsis pre-fill from scripts** — When a `script_master` or `episode_script` is imported, episode synopses should be auto-populated
2. **No character count validation** — If extracted characters differ significantly from what's in `character_profiles`, no warning is raised
3. **No "Project Brain" summary endpoint** — A single endpoint that returns the complete state of a project's knowledge (how many episodes filled, how many characters, coverage %) for the dashboard

### Implementation List

| # | Fix | File |
|---|-----|------|
| 1 | Auto-apply extracted episodes in `create-series` | `supabase/functions/create-series/index.ts` |
| 2 | Add `apply-corpus` action to `import-document` | `supabase/functions/import-document/index.ts` |
| 3 | Inject episode-specific corpus in `episode-pipeline` | `supabase/functions/episode-pipeline/index.ts` |
| 4 | Add governance state reconciliation helper | `supabase/functions/run-agent/index.ts` (in `maybeAdvanceEpisode`) |
| 5 | Add project knowledge summary endpoint | `supabase/functions/import-document/index.ts` (new action `project_brain_summary`) |
| 6 | Frontend: trigger apply-corpus after doc processing | `src/hooks/useDocuments.ts` or equivalent |

---

## Part 3 — README Rewrite

Complete rewrite of `README.md` to include:

1. **Governance section expanded**: Full 18-state machine documented with allowed transitions, guard conditions, and enforcement modes
2. **Episode pipeline**: 10-step autopilot pipeline with agents, gates, thresholds
3. **Document ingestion**: Complete extraction pipeline with 30+ entity types, confidence rules, source hierarchy
4. **Autofill lifecycle**: How extracted data flows from documents → entities → canonical fields → episodes/characters/bibles → agent context → generation prompts
5. **Provider routing**: Complete provider matrix with quality tiers, fallback chains, cost per provider
6. **Anti-aberration**: Taxonomy, auto-repair logic, validation passes
7. **Cost governance**: Credits, budget ceilings, provider-aware costing
8. **Security**: RLS, JWT, audit, secrets management
9. **All edge functions**: Complete function reference with inputs/outputs
10. **Data model**: All table groups with key columns

---

## Execution Order

1. Part 1A: `create-series` autofill from extracted entities
2. Part 1B: `apply-corpus` action in `import-document`
3. Part 2 fixes: Episode pipeline corpus injection, governance reconciliation, project brain summary
4. Part 1C: Frontend trigger
5. Part 3: README rewrite
6. Deploy all edge functions

### Estimated scope
- 5 edge functions modified
- 1 frontend file modified
- README.md fully rewritten (~1200 lines)
- All modified edge functions redeployed

