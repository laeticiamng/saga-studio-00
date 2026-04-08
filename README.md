# Saga Studio — AI-Powered Production Platform

> Transform ideas, scripts, and creative documents into fully-produced audiovisual works (series, films, music videos, hybrid video) using AI agents, multi-provider generation, and strict governance.

---

## Table of Contents

1. [Vision & Architecture](#vision--architecture)
2. [Production Modes](#production-modes)
3. [Document Ingestion & Autofill](#document-ingestion--autofill)
4. [Episode Pipeline (Autopilot)](#episode-pipeline-autopilot)
5. [Agent System](#agent-system)
6. [Provider Matrix & Routing](#provider-matrix--routing)
7. [Production Pipelines](#production-pipelines)
8. [Governance Engine](#governance-engine)
9. [Anti-Aberration & Validation](#anti-aberration--validation)
10. [Cost & Credit Governance](#cost--credit-governance)
11. [Review Gates & Approval System](#review-gates--approval-system)
12. [Timeline Studio](#timeline-studio)
13. [Export & Delivery](#export--delivery)
14. [Security & Access Control](#security--access-control)
15. [Edge Functions Reference](#edge-functions-reference)
16. [Data Model](#data-model)
17. [Tech Stack](#tech-stack)

---

## Vision & Architecture

Saga Studio is a **Document-First** AI production studio. Users provide creative materials (scripts, bibles, moodboards, pitch decks) and the platform:

1. **Ingests** documents, classifies them, and extracts 30+ entity types
2. **Plans** the production via AI agents (showrunner, story architect, visual director...)
3. **Generates** visual assets across multiple providers (Runway, Veo, Luma, OpenAI)
4. **Assembles** clips into multi-track timelines with beat-sync
5. **Validates** every asset through anti-aberration passes
6. **Delivers** mastered exports with QC checks

```
┌──────────────────────────────────────────────────────────────┐
│                     Document Corpus                          │
│  Scripts · Bibles · Moodboards · Pitch Decks · References    │
└───────────────┬──────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────┐
│              Intelligent Ingestion Engine                     │
│  Classify → Extract → Chunk → Canonicalize → Autofill        │
└───────────────┬──────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────┐
│                    Project Brain                              │
│  Canonical Fields · Character Profiles · World Bible          │
│  Episode Data · Continuity Memory Graph                       │
└───────────────┬──────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────┐
│              Agent Orchestration (25 agents)                  │
│  Showrunner → Story Architect → Scriptwriter → Visual Dir     │
│  → Scene Designer → Shot Planner → QA Reviewer → Editor      │
└───────────────┬──────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────┐
│           Multi-Provider Generation Engine                    │
│  Runway Gen-4.5 · Veo 3.1 · Luma Photon · Act-Two · Aleph   │
└───────────────┬──────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────┐
│              Assembly & Validation                            │
│  Timeline → Beat-Sync → Anti-Aberration → QC → Master        │
└──────────────────────────────────────────────────────────────┘
```

---

## Production Modes

### Series
Multi-season, multi-episode productions with full continuity tracking, character memory graphs, and episode-by-episode autopilot pipeline.

### Film
Single long-form production with emphasis on visual bible design upfront. Uses the same pipeline as Series but without episode repetition.

### Music Video
Beat-synchronized production driven by audio analysis (BPM, energy, sections). Veo 3.1 is the primary generation engine for iconic visual shots.

### Hybrid Video
Import existing video footage → AI-based transformation, enhancement, and stylization via Aleph/Luma Modify. Includes dedicated upload, segmentation, and transform pipeline steps.

---

## Document Ingestion & Autofill

### Supported Document Types
| Role | Description |
|------|-------------|
| `script_master` | Master screenplay / master script |
| `episode_script` | Per-episode screenplay |
| `film_script` | Film screenplay |
| `music_video_concept` | Music video treatment / concept |
| `series_bible` | Series bible with characters, world, arcs |
| `short_pitch` | Short pitch / elevator pitch |
| `producer_bible` | Producer bible with budgets, schedules |
| `one_pager` | Project one-pager |
| `continuity_doc` | Continuity reference document |
| `governance_doc` | Production governance / policy document |
| `character_sheet` | Character design sheets |
| `world_pack_doc` | World-building / location reference |
| `moodboard_doc` | Visual moodboard |
| `wardrobe_doc` | Wardrobe / costume reference |
| `music_doc` | Music brief / soundtrack reference |
| `lyric_doc` | Song lyrics |
| `production_notes` | Production notes |
| `legal_notes` | Legal / clearance notes |
| `reference_images` | Visual reference images |

### Extraction Pipeline

```
Upload → Classify Role → Extract Text → Chunk (structured) → AI Extraction → Entity Storage
                                                                    │
                                                                    ▼
                                                        Canonical Field Merge
                                                        Conflict Detection
                                                        Missing Info Detection
                                                        Autofill Propagation
```

### 30+ Extracted Entity Types
`character` · `location` · `episode` · `scene` · `synopsis` · `logline` · `genre` · `tone` · `theme` · `target_audience` · `relationship` · `character_arc` · `chronology` · `dialogue_sample` · `emotional_arc` · `visual_reference` · `cinematic_reference` · `color_palette` · `lighting` · `camera_direction` · `mood` · `ambiance` · `sensory_note` · `continuity_rule` · `wardrobe` · `prop` · `act_structure` · `season_arc` · `beat_map` · `lyric_section` · `performance_cue` · `production_directive` · `transition` · `sound_design` · `music` · `format` · `duration`

### Source Priority Hierarchy
1. **source_of_truth** (priority 5) — Definitive, overrides everything
2. **preferred_source** (priority 4) — Primary reference
3. **supporting_reference** (priority 3) — Supplementary
4. **draft_only** (priority 2) — Working documents
5. **deprecated** (priority 1) — Outdated / superseded

### Autofill Lifecycle

```
Documents → Extracted Entities → Canonical Fields
                                       │
                ┌──────────────────────┼──────────────────────┐
                ▼                      ▼                      ▼
          Episodes              Characters              World Bible
     (title, synopsis,      (name, appearance,     (locations, props,
      duration, scenes)      personality, arc)       visual refs, moods)
                                       │
                                       ▼
                              Agent Context Injection
                              (corpus_canon, corpus_entities,
                               production_directives)
                                       │
                                       ▼
                              Generation Prompts
```

When a series is created, the system automatically:
- Queries extracted `episode` entities and pre-fills episode titles, synopses, durations
- Creates `character_profiles` from extracted `character` entities
- Assembles a `world` bible from extracted `location`, `visual_reference`, `prop`, and `mood` entities
- The `apply_corpus` action can be triggered anytime to re-propagate latest extractions

### Project Brain Summary
The `project_brain_summary` endpoint provides a real-time coverage report:
- Document count by role
- Entity counts by type
- Episode coverage percentage (how many have synopses)
- Character count, bible count, continuity nodes
- Unresolved canonical conflicts
- Overall coverage score (0-100%)

---

## Episode Pipeline (Autopilot)

Each episode progresses through a 10-step automated pipeline with specialized AI agents, confidence scoring, and approval gates.

### Pipeline Steps

| # | Step | Agents | Approval Gate | Auto-Approve Threshold |
|---|------|--------|---------------|----------------------|
| 1 | `story_development` | story_architect, scriptwriter | No | — |
| 2 | `psychology_review` | psychology_reviewer | Yes | 85% |
| 3 | `legal_ethics_review` | legal_ethics_reviewer | Yes | 90% |
| 4 | `visual_bible` | visual_director | No | — |
| 5 | `continuity_check` | continuity_checker | Yes | 90% |
| 6 | `shot_generation` | scene_designer, shot_planner | No | — |
| 7 | `shot_review` | qa_reviewer | Yes | 80% |
| 8 | `assembly` | editor | No | — |
| 9 | `edit_review` | qa_reviewer | Yes | 85% |
| 10 | `delivery` | delivery_manager | No | — |

### Features
- **Idempotency**: Unique idempotency keys prevent duplicate agent runs
- **Correlation IDs**: All runs share a correlation ID for tracing
- **Auto-continuation**: Steps auto-advance when gates pass
- **Failure handling**: Episodes marked `failed` after 3 retries
- **Stale gate invalidation**: Upstream re-runs invalidate downstream gates
- **Corpus injection**: Each agent receives episode-specific extracted data (synopsis, scenes, characters)

---

## Agent System

### 25 Specialized Agents

| Agent | Category | Role |
|-------|----------|------|
| `showrunner` | Direction | Overall creative direction and orchestration |
| `story_architect` | Narrative | Story structure, arcs, themes, dramatic progression |
| `scriptwriter` | Narrative | Dialogue, stage directions, transitions |
| `script_doctor` | Narrative | Identify narrative weaknesses, propose fixes |
| `dialogue_coach` | Narrative | Refine character voices and dialogue naturalness |
| `psychology_reviewer` | Review | Character psychology, motivation coherence |
| `legal_ethics_reviewer` | Review | Legal compliance, ethics, cultural sensitivity |
| `continuity_checker` | Review | Cross-episode continuity validation |
| `visual_director` | Visual | Visual style, color palette, lighting bible |
| `scene_designer` | Visual | Scene breakdown with locations, moods, durations |
| `shot_planner` | Visual | Shotlist with camera angles, movement, prompts |
| `music_director` | Audio | Soundtrack selection, musical themes |
| `voice_director` | Audio | Vocal casting, tone direction |
| `editor` | Post | Edit planning, transitions, rhythm, assembly |
| `colorist` | Post | Color grading, visual consistency |
| `qa_reviewer` | QC | Multi-dimensional quality assessment |
| `delivery_manager` | QC | Export specs, technical compliance |
| `casting_consistency` | Continuity | Character visual coherence across episodes |
| `production_designer` | Design | Set design, environment, visual world |
| `costume_designer` | Design | Character wardrobe per scene and arc |
| `props_designer` | Design | Key props, inter-episode consistency |
| `sound_music` | Audio | Sound design, effects, audio atmosphere |
| `delivery_supervisor` | QC | Final technical compliance before export |

### Agent Output Writers
- `psychology_reviewer` → `psychology_reviews`
- `legal_ethics_reviewer` → `legal_ethics_reviews`
- `continuity_checker` → `continuity_reports`
- `scene_designer` → `scenes`
- `scriptwriter` → `scripts` + `script_versions`

---

## Provider Matrix & Routing

### Active Providers

| Provider | Model | Output | Cost/sec | Use Case |
|----------|-------|--------|----------|----------|
| **Nano Banana 2** | gemini-3.1-flash-image-preview | Image | $0.01 | Fast image iteration |
| **Nano Banana Pro** | gemini-3-pro-image-preview | Image | $0.03 | Premium image, world bibles |
| **Veo 3.1** | veo-3.1-generate-preview | Video | $0.10 | Hero shots, prestige |
| **Veo 3.1 Lite** | veo-3.1-lite-generate-preview | Video | $0.05 | Fast video iteration |
| **Runway Gen-4.5** | gen4.5 | Video | $0.40 | Scene backbone, narrative |
| **Runway Act-Two** | act_two | Video | $0.40 | Acting, performance |
| **Runway Aleph** | aleph | Video | $0.35 | Transform, repair |
| **Luma Photon-1** | photon-1 | Image | $0.02 | Identity stabilization |
| **Luma Photon Flash** | photon-flash-1 | Image | $0.01 | Fast identity |
| **Luma Ray-2** | ray-2 | Video | $0.15 | Alternative video gen |
| **Luma Reframe** | reframe | Video | $0.05 | Social export derivation |
| **Luma Modify** | modify | Video | $0.10 | Video transformation |
| **GPT Image 1.5** | gpt-image-1.5 | Image | $0.08 | Marketing, posters |

### Quality Tiers
| Tier | Primary Providers | Credits/Shot |
|------|------------------|-------------|
| **premium** | Veo 3.1, Runway Gen-4.5, Act-Two | 5 |
| **standard** | Runway Gen-4.5, Veo 3.1 Lite, Ray-2 | 2 |
| **economy** | Nano Banana 2, Photon Flash, Veo Lite | 1 |

---

## Production Pipelines

### Series / Film Pipeline
```
Identity Pack (Photon) → Lookdev (Nano Pro) → World Pack (Nano Pro)
  → Scene Backbone (Runway Gen-4.5) → Acting (Act-Two)
  → Hero Shots (Veo 3.1) → Repair (Aleph) → Social Exports (Reframe)
  → Poster (GPT Image 1.5)
```

### Music Video Pipeline
```
Identity Pack (Photon) → Lookdev (Nano Pro)
  → Iconic Shots (Veo 3.1) → Acting (Act-Two)
  → Repair (Aleph) → Social Exports (Reframe) → Poster (GPT Image 1.5)
```

### Hybrid Video Pipeline
```
Source Upload → Segmentation (Aleph) → Transform (Luma Modify)
  → Stylize (Aleph) → Repair (Aleph) → Social Exports (Reframe)
  → Poster (GPT Image 1.5)
```

---

## Governance Engine

### 18-State Machine

```
draft → setup_in_progress → awaiting_identity_review → awaiting_world_review
     → planning → awaiting_scene_review → generating → awaiting_clip_review
     → assembling → awaiting_rough_cut_review → fine_cut_in_progress
     → awaiting_fine_cut_review → qc_pending → export_ready → exporting
     → delivered

Special states: failed, archived (reachable from any state)
```

### Pipeline ↔ Governance Reconciliation
| Pipeline Status | Governance State |
|----------------|-----------------|
| `story_development` | `planning` |
| `visual_bible` | `setup_in_progress` |
| `continuity_check` | `awaiting_scene_review` |
| `shot_generation` | `generating` |
| `shot_review` | `awaiting_clip_review` |
| `assembly` | `assembling` |
| `edit_review` | `awaiting_rough_cut_review` |
| `delivery` | `exporting` |
| `completed` | `delivered` |

### Governance Policies
- **block**: Hard stop — operation is prevented
- **warn**: Operation proceeds, warning logged
- **log**: Operation proceeds, event logged silently

### Violation Tracking
All violations logged to `governance_violations` with policy_key, actor_type, severity, and resolution status.

---

## Anti-Aberration & Validation

### Validation Passes
| Pass | Checks |
|------|--------|
| **Technical** | Resolution, codec, duration, FPS, aspect ratio |
| **Visual** | Anatomy (hands, faces), physics, composition |
| **Semantic** | Prompt adherence, scene accuracy |
| **Continuity** | Character consistency, wardrobe, location |
| **Delivery** | Export spec compliance, loudness, color space |

### Repair Router
1. **Low severity** → Flag for review
2. **Medium** → Auto-repair via Aleph
3. **High** → Force regeneration with different provider
4. **Critical** → Force regeneration, exclude original provider

---

## Cost & Credit Governance

- New users: **10 credits** at signup
- `debit_credits` / `topup_credits` database functions (idempotent, row-locked)
- Provider-aware costing: Runway = 5 credits, Veo = 4, Aleph = 3, Ray-2 = 2, economy = 1
- Budget ceiling enforcement via `estimate-cost`
- Full audit trail in `credit_ledger`

---

## Review Gates & Approval System

```
Agent completes → Confidence score → Check threshold
  ├─ Above → Auto-approve → Advance pipeline
  └─ Below → Wait for human approval
```

- `approval_steps` / `approval_decisions` / `workflow_approvals` tables
- `workflow_confidence_scores` for per-dimension transparency

---

## Timeline Studio

- Multi-track timeline (video, audio, text, overlay)
- Frame-precise clip placement
- Beat-sync engine for music video mode (BPM-aligned cuts)
- Assembly: Scenes → Shots → Timeline → Beat-Sync → Rough Cut → Fine Cut → Master

---

## Export & Delivery

- Pre-configured export presets (resolution, FPS, codec, aspect ratio, audio)
- Delivery QC: black frames, audio gaps, loudness, codec validation
- Versioned exports with checksum and approval tracking
- Only completed renders are exported (`.eq("status", "completed")`)

---

## Security & Access Control

- JWT validation on every edge function
- RLS on all tables (user ownership)
- Roles in `user_roles` table with `has_role()` security definer
- All API keys in Lovable Cloud Secrets (never client-side)
- Full audit logging with correlation IDs
- Rate limiting on creation endpoints

---

## Edge Functions Reference

### Core: `create-project`, `create-series`, `plan-project`, `generate-shots`, `check-shot-status`, `assemble-rough-cut`, `stitch-render`, `batch-render`
### Ingestion: `import-document` (register, extract, reprocess, batch_process, detect_conflicts, detect_missing, wizard_extract, apply_corpus, project_brain_summary)
### Agents: `episode-pipeline`, `run-agent`, `agent-status`, `autopilot-run`
### Quality: `validate-asset`, `continuity-check`, `delivery-qc`, `approval-evaluate`, `redaction-pass`
### Export: `export-assets`, `proxy-media`
### Workflow: `workflow-pause`, `workflow-resume`, `workflow-cancel-safe`
### Infra: `estimate-cost`, `provider-health`, `system-health`, `enhance-synopsis`, `analyze-audio`, `project-status`, `audit-log`, `dispatch-webhooks`, `cleanup`, `client-log`
### Billing: `create-checkout`, `check-subscription`, `customer-portal`, `stripe-webhook`
### Admin: `admin-actions`, `delete-account`, `send-contact`, `process-email-queue`

---

## Data Model

| Group | Tables |
|-------|--------|
| **Projects** | `projects`, `project_assets`, `project_knowledge`, `project_budgets` |
| **Series** | `series`, `seasons`, `episodes`, `scenes`, `episode_shots` |
| **Scripts** | `scripts`, `script_versions` |
| **Characters** | `character_profiles`, `character_reference_packs` |
| **World** | `bibles`, `continuity_groups` |
| **Continuity** | `continuity_memory_nodes`, `continuity_memory_edges`, `continuity_conflicts`, `continuity_reports` |
| **Documents** | `source_documents`, `source_document_entities`, `source_document_chunks`, `source_document_mappings` |
| **Canonical** | `canonical_fields`, `canonical_conflicts`, `field_provenance`, `inferred_completions` |
| **Agents** | `agent_registry`, `agent_prompts`, `agent_runs`, `agent_outputs` |
| **Workflow** | `workflow_runs`, `workflow_steps`, `workflow_step_runs`, `workflow_approvals`, `workflow_confidence_scores` |
| **Quality** | `asset_validations`, `anomaly_events`, `aberration_categories` |
| **Governance** | `governance_policies`, `governance_transitions`, `governance_violations` |
| **Timeline** | `timelines`, `timeline_tracks`, `timeline_clips` |
| **Export** | `export_presets`, `export_versions`, `export_jobs`, `delivery_manifests` |
| **Credits** | `credit_wallets`, `credit_ledger` |
| **Users** | `profiles`, `user_roles` |
| **Audit** | `audit_logs`, `diagnostic_events`, `incidents` |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + Vite 5 + TypeScript 5 |
| **Styling** | Tailwind CSS v3 + shadcn/ui |
| **State** | TanStack Query v5 |
| **Routing** | React Router v6 |
| **Animation** | Framer Motion |
| **Backend** | Lovable Cloud (Auth, Postgres, Storage, Edge Functions) |
| **AI Gateway** | Lovable AI Gateway (multi-model routing) |
| **Video Providers** | Runway, Google Veo, Luma, OpenAI |
| **Payments** | Stripe |
| **Email** | Resend + PGMQ |
| **Assembly** | FFmpeg (WASM) |

---

## Development

```bash
npm install
npm run dev
npm test
npm run build
```
