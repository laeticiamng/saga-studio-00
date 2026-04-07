# Saga Studio — Production-Grade AI Audiovisual Studio

Saga Studio is a production-grade AI audiovisual studio for planning, generating, assembling, validating, and delivering premium **series**, **films**, **music videos**, and **hybrid video** works.

The platform ingests a project corpus (scripts, bibles, reference images, notes, governance docs), extracts structured knowledge, resolves conflicts, builds canonical project truth, and then orchestrates the entire production lifecycle — from scene planning through validated export — without requiring the user to re-enter the same information twice.

---

## Table of Contents

1. [Product Vision](#product-vision)
2. [Supported Project Types](#supported-project-types)
3. [Core Capabilities](#core-capabilities)
4. [End-to-End Workflow Lifecycle](#end-to-end-workflow-lifecycle)
5. [Architecture Overview](#architecture-overview)
6. [Ingestion & Project Memory](#ingestion--project-memory)
7. [Provider Routing](#provider-routing)
8. [Anti-Aberration & Validation](#anti-aberration--validation)
9. [Timeline / Assembly / Editing](#timeline--assembly--editing)
10. [Review Gates](#review-gates)
11. [Finishing & Export](#finishing--export)
12. [Governance Model](#governance-model)
13. [Cost Governance](#cost-governance)
14. [Diagnostics & QC](#diagnostics--qc)
15. [Data Model Overview](#data-model-overview)
16. [Frontend & UX](#frontend--ux)
17. [Key Jobs & Orchestration](#key-jobs--orchestration)
18. [Cloud, Security & Operations](#cloud-security--operations)
19. [Development & Contribution Guidelines](#development--contribution-guidelines)
20. [Roadmap & Feature Flags](#roadmap--feature-flags)
21. [Tech Stack](#tech-stack)
22. [Quick Start](#quick-start)
23. [Documentation Index](#documentation-index)

---

## Product Vision

Saga Studio operates as an **intelligent production reader and project brain**: the user uploads their corpus once, the system understands it, builds canonical project truth, fills small gaps coherently, and then reuses that understanding throughout the entire audiovisual generation pipeline without redundant friction.

The platform is **not** a basic generation playground, a simple provider hub, or a lightweight MVP. It is a governed, quality-gated production system designed to produce **export-ready audiovisual works** at professional standards.

**Target users**: independent creators, studios, production companies, and audiovisual professionals who need to go from concept to deliverable with AI assistance while retaining full creative control.

---

## Supported Project Types

### Series

Multi-season, multi-episode narrative workflows. The platform understands season arcs, episode structures, recurring characters, continuity dependencies between episodes, and cliffhanger rhythm. Users upload a series corpus and the system derives a usable series structure without manual episode-by-episode data entry.

**Structure**: Project → Series → Seasons → Episodes → Scenes → Shots  
**Key modules**: Episode pipeline, season arc tracking, cross-episode continuity, recurring character/location management, series bible.

### Film

Feature-length or short film workflows. The platform understands act structure (3-act, 5-act), narrative sequence, character arcs, visual motifs, prestige shot opportunities, and montage logic.

**Structure**: Project → Scenes → Shots  
**Key modules**: Act structure analysis, chronology tracking, visual motif extraction, prestige shot flagging.

### Music Video

Audio-driven clip workflows. The platform understands lyrics, beat maps, performance cues, section moods, refrain repetition logic, and iconic shot requirements.

**Structure**: Project → Audio analysis → Sections → Shots  
**Key modules**: Beat mapping, lyric section extraction, performance cue identification, section mood tracking, artist lookdev.

### Hybrid Video

Source video upload → AI transformation workflows. Users upload existing footage and the platform segments, transforms, stylizes, and reassembles it.

**Structure**: Project → Source clips → Transformed clips → Assembly  
**Key modules**: Video segmentation, style transfer, clip transformation, reassembly.

---

## Core Capabilities

| Capability | Description |
|---|---|
| **Document Ingestion** | Multi-file upload with AI classification into 20+ document roles, structured extraction of 30+ entity types |
| **Canonical Extraction** | Merge engine that deduplicates, resolves conflicts, proposes canonical project truth |
| **Character / World Builder** | Character profiles with visual descriptions, relationships, wardrobe, arcs; world/location/prop management via bibles |
| **Scene Planner** | Scene breakdown with location, characters, mood, props, time of day; auto-populated from ingested scripts |
| **Continuity Groups** | Cross-scene/episode consistency enforcement via continuity memory graph (nodes + edges) |
| **Provider Routing** | Capability-based routing across Google, Runway, Luma, OpenAI models with quality tiers and fallback chains |
| **Anti-Aberration Validation** | Multi-pass validation (technical, visual, semantic, continuity, narrative) with aberration taxonomy and auto-repair |
| **Timeline Engine** | Multi-track timeline (video, dialogue, music, FX) with versioning, clip management, and lock logic |
| **Auto-Assembly** | Automated rough cut assembly from validated shots with candidate ranking |
| **Rough Cut / Fine Cut** | Progressive refinement from rough assembly to polished edit with review gates at each stage |
| **Finishing Presets** | Non-destructive look harmonization (cinematic, glossy, etc.) and audio normalization |
| **Export Engine** | Versioned exports (1080p master, 720p preview, 9:16 social) with format presets and checksum validation |
| **QC Layer** | Quality control reports with pass/fail per dimension before any export is released |
| **Diagnostics Hub** | Full visibility into errors, provider fallbacks, clip candidate rankings, and incident history |
| **Governance Dashboard** | Centralized project state tracking, policy enforcement, incident management, violation logging |
| **Cost Governance** | Project budget ceilings, cost estimation before generation, preview-first / premium-first modes, hard-stop thresholds |
| **Storage Lifecycle** | Managed storage buckets with access policies; source documents, face references, shot outputs, renders |

---

## End-to-End Workflow Lifecycle

```
Upload / Ingest
  → Document classification + entity extraction
  → Canonical merge + conflict resolution
  → Character / world approval
  → Scene planning
  → Generation (provider-routed)
  → Validation (anti-aberration)
  → Assembly (rough cut)
  → Rough cut review gate
  → Fine cut
  → Finishing (look + audio harmonization)
  → QC (quality control report)
  → Export (versioned, format-specific)
```

### Step Details

| Step | Purpose | Inputs | Outputs | User Approval? |
|------|---------|--------|---------|----------------|
| **Ingest** | Upload and understand project materials | Files (PDF, DOCX, images, audio) | Classified documents, extracted entities | Optional role correction |
| **Canonical Merge** | Build single source of truth | All extracted entities | Canonical fields, conflict list | Resolve material conflicts |
| **Character/World** | Lock visual identity and world rules | Character sheets, bibles, reference images | Approved character packs, world packs | Yes — identity review gate |
| **Scene Planning** | Break project into generatable units | Scripts, episode structures | Scene list with prompts, locations, characters | Yes — scene plan gate |
| **Generation** | Produce visual/video assets per scene | Scene prompts, style refs, continuity context | Raw shots (images/videos) | No (automated) |
| **Validation** | Check generated assets for quality | Raw shots, validation rules | Pass/fail scores, aberration flags | No (automated, triggers repair if needed) |
| **Assembly** | Combine validated shots into timeline | Validated shots, scene order | Rough cut timeline | No (automated) |
| **Rough Cut Review** | Human review of assembled sequence | Rough cut timeline | Approve / reject / request changes | Yes |
| **Fine Cut** | Polish edit with replacements/adjustments | Rough cut + user feedback | Fine cut timeline | Yes |
| **Finishing** | Apply look harmonization and audio normalization | Fine cut timeline, finishing presets | Finished master | Optional |
| **QC** | Final quality check before export | Finished timeline | QC report (pass/fail) | Blocking if fail |
| **Export** | Generate deliverable files | QC-passed timeline, export presets | Versioned output files (MP4, etc.) | No |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React 18 + Vite + Tailwind + shadcn/ui)          │
│  ─ Dashboard, Studio, Timeline, Review Gates, Export Center │
└────────────────────────┬────────────────────────────────────┘
                         │ Supabase JS Client
┌────────────────────────▼────────────────────────────────────┐
│  Lovable Cloud (Supabase)                                    │
│  ├── Auth (JWT, email, OAuth)                                │
│  ├── PostgreSQL (50+ tables, RLS on all)                     │
│  ├── Edge Functions (30+ serverless functions)               │
│  ├── Storage (5 buckets: source-documents, face-references,  │
│  │           shot-outputs, renders, audio-uploads)            │
│  └── Realtime (postgres_changes subscriptions)               │
└────────────────────────┬────────────────────────────────────┘
                         │ Server-side only
┌────────────────────────▼────────────────────────────────────┐
│  AI Providers (via Edge Functions — no client-side calls)     │
│  ├── Lovable AI Gateway (Gemini, GPT) — extraction, analysis │
│  ├── Google Veo 3.1 — premium hero shots                     │
│  ├── Runway Gen-4.5 / Act-Two / Aleph — scenes, acting, fx  │
│  ├── Luma Photon / Ray / Reframe — refs, derivatives, social │
│  └── OpenAI GPT Image — posters, title cards, marketing      │
└─────────────────────────────────────────────────────────────┘
```

**Invariants**:
- All AI provider calls happen server-side via Edge Functions
- No API keys are exposed to the client
- All tables have Row Level Security enabled
- All state transitions are governed

---

## Ingestion & Project Memory

### Intelligent Document Ingestion

The platform supports importing multiple documents simultaneously. Each uploaded file is automatically classified into one of 20+ document roles:

`script_master`, `episode_script`, `film_script`, `music_video_concept`, `series_bible`, `short_pitch`, `producer_bible`, `one_pager`, `continuity_doc`, `governance_doc`, `character_sheet`, `world_pack_doc`, `moodboard_doc`, `wardrobe_doc`, `music_doc`, `lyric_doc`, `production_notes`, `legal_notes`, `reference_images`, `unknown`

### Extraction Pipeline

1. **Upload** — Files stored in `source-documents` bucket
2. **Classification** — AI determines document role + confidence score
3. **Text extraction** — Native text for TXT/MD; parsed text for PDF/DOCX
4. **Chunking** — Text split into 2000-char segments
5. **AI Entity Extraction** — Gemini extracts 30+ entity types with structured values
6. **Canonical Merge** — Entities compared against existing project truth; higher-priority sources win
7. **Conflict Detection** — Cross-document contradictions surfaced with severity classification
8. **Missing Info Detection** — Required fields checked per project type; AI proposes inferred completions
9. **Knowledge Graph** — Entities linked to scenes, characters, props, locations, timeline beats

### Extraction Adapts to Project Type

- **Series**: Extracts episodes, season arcs, continuity dependencies, recurring elements, callbacks
- **Film**: Extracts act structure, narrative sequences, visual motifs, prestige shots, montage notes
- **Music Video**: Extracts lyric sections, beat maps, performance cues, section moods, iconic shots

### Source Priority Hierarchy

| Priority | Label | Behavior |
|---|---|---|
| 5 | Source of truth | Always wins in merge conflicts |
| 4 | Preferred source | Wins unless source of truth exists |
| 3 | Supporting reference | Used when no higher source exists |
| 2 | Draft only | Never auto-promoted to canonical |
| 1 | Deprecated | Excluded from canonical context |

### Confidence Rules

- **≥ 0.85**: Auto-approved, immediately canonical
- **0.60–0.85**: Proposed, requires user validation
- **< 0.60**: Suggestion only, shown but not applied

### Contextual Retrieval

At generation time, the platform retrieves only the relevant context subset — not raw documents. Retrieval is scoped by:
- **Scene**: locations, props, mood, continuity rules, visual references
- **Episode**: scenes, characters, continuity rules, cliffhangers, season arc
- **Character**: relationships, wardrobe, costume, visual references
- **Timeline**: chronology, scenes, episodes, music, montage notes
- **Continuity**: rules, characters, wardrobe, props, locations, recurring elements

Context is sorted by source priority + confidence and trimmed to fit provider context windows.

---

## Provider Routing

Providers are routed by **capability**, not by brand. Each provider serves a specific production role:

| Provider | Model | Role |
|---|---|---|
| **Google** | Nano Banana / Pro | Image ideation, canonical design packs, visual bibles |
| **Google** | Veo 3.1 | Premium hero shots, iconic moments, prestige-grade video |
| **Runway** | Gen-4.5 | Narrative scene generation backbone (consistent, reliable) |
| **Runway** | Act-Two | Acting, performance, character-driven motion |
| **Runway** | Aleph | Transformation, repair, style transfer, VFX |
| **Luma** | Photon-1 | Identity stabilization, style references, consistency |
| **Luma** | Ray-2 / Reframe | Derivatives, social format reframing (9:16, 1:1) |
| **OpenAI** | GPT Image 1.5 | Posters, title cards, marketing assets |

### Routing Principles

- **Quality tiers**: Preview (fast/cheap), Standard (balanced), Premium (maximum quality)
- **Fallback chains**: If primary provider fails, system routes to next capable provider
- **No silent image fallback**: Premium projects never silently downgrade from video to static images
- **Provider health**: Provider availability is monitored; unhealthy providers are temporarily bypassed
- **Cost awareness**: Provider selection considers project budget mode and remaining budget

---

## Anti-Aberration & Validation

Validation is a **core product principle**, not an optional add-on. Every generated asset passes through multi-pass validation before entering the timeline.

### Validation Passes

| Pass | What it checks |
|---|---|
| **Technical** | Resolution, aspect ratio, codec, duration, file integrity |
| **Visual** | Anatomy, physics, lighting consistency, artifact detection |
| **Semantic** | Script adherence, scene description match, dialogue accuracy |
| **Continuity** | Character appearance consistency, location consistency, prop presence |
| **Narrative** | Story logic, emotional tone, pacing appropriateness |
| **Delivery** | Export readiness, format compliance, QC thresholds |

### Aberration Taxonomy

Aberrations are classified by category and subcategory (e.g., `anatomy > extra_fingers`, `physics > floating_objects`, `continuity > costume_drift`, `identity > face_mismatch`). Each aberration has:
- Severity (critical, high, medium, low)
- Blocking flag (whether it prevents timeline insertion)
- Suggested fix (regenerate, repair, manual review)
- Auto-repair eligibility

### Auto-Repair Logic

When a fixable aberration is detected:
1. System checks if the aberration is eligible for auto-repair
2. Routes to appropriate repair provider (e.g., Aleph for transformation)
3. Re-validates the repaired asset
4. If repair fails after max retries, flags for human review

---

## Timeline / Assembly / Editing

### Timeline Model

- **Timelines** — versioned containers for an assembled work
- **Tracks** — typed layers within a timeline (video, dialogue, music, sfx)
- **Clips** — individual media segments placed on tracks with in/out points

### Assembly Flow

1. **Candidate generation** — Multiple shot candidates generated per scene
2. **Candidate ranking** — Validation scores, continuity scores, and aesthetic scores combined
3. **Auto-assembly** — Best candidates placed on timeline in scene order
4. **Rough cut** — First assembled version for human review
5. **Fine cut** — Polished version after clip replacements, timing adjustments
6. **Lock** — Final timeline version locked for finishing

### Version Management

Each timeline maintains version history. Review gates reference specific timeline versions. Stale gates (where the timeline has changed since the gate was passed) are automatically invalidated.

---

## Review Gates

Review gates are mandatory checkpoints requiring human or automated approval before the pipeline proceeds.

| Gate | Validates | On Approve | On Reject |
|---|---|---|---|
| `character_pack` | Character visual identity locked | Proceed to world pack | Regenerate character refs |
| `world_pack` | World/location visual identity locked | Proceed to scene planning | Revise world bible |
| `scene_plan` | Scene breakdown approved | Proceed to generation | Revise scene plan |
| `scene_clips` | Generated clips meet quality bar | Proceed to assembly | Regenerate failed clips |
| `rough_cut` | Assembled sequence acceptable | Proceed to fine cut | Request changes |
| `fine_cut` | Polished edit approved | Proceed to finishing | Request changes |
| `final_export` | QC passed, export ready | Release deliverable | Block export |

**Gate rules**:
- Gates are version-aware: approving gate X at timeline version N does not cover version N+1
- Stale gates are automatically flagged when upstream content changes
- Dependencies are enforced: `fine_cut` cannot pass before `rough_cut` is approved

---

## Finishing & Export

### Finishing

Finishing is **non-destructive** — it applies look harmonization on top of source assets without modifying originals.

- **Look presets**: Cinematic, glossy, natural, noir, vintage, etc.
- **Audio normalization**: LUFS-based loudness normalization
- **Subtitle options**: Burn-in or sidecar subtitle tracks
- **Title cards**: Auto-generated or custom title/end cards

### Export

- **Export presets**: Platform-defined presets (1080p master, 720p preview, 9:16 social, 4K master)
- **Versioned outputs**: Each export is versioned with checksum, duration, file size
- **QC gate**: Exports are blocked until QC report passes
- **Format support**: MP4/H.264, MP4/H.265, WebM (configurable codec, bitrate, audio codec)

---

## Governance Model

Governance is a **platform pillar**, not an afterthought.

| Domain | What is governed |
|---|---|
| **State Machine** | All project/episode/shot status transitions follow defined state machines |
| **Source of Truth** | Canonical fields are explicitly sourced and traceable |
| **Policy Engine** | Configurable policies with enforcement modes (strict, warn, log) |
| **Ownership** | Every asset, decision, and state change is attributed to a user or agent |
| **Versioning** | Timelines, exports, bibles, scripts — all versioned |
| **Provider** | Provider selection follows routing policies, not ad-hoc choices |
| **Cost** | Budget ceilings and cost modes govern generation spending |
| **Data** | RLS on all tables; audit logs for sensitive actions |
| **Incidents** | Failures are logged as incidents with severity, root cause, and resolution |
| **Feature Flags** | New capabilities are gated behind feature flags for staged rollout |

### Governance Transitions

State transitions are defined in `governance_transitions` with:
- `from_state` → `to_state`
- `guard_conditions` (must be satisfied)
- `required_approvals` (human or agent gates)

Violations of governance policies are logged to `governance_violations` with severity, actor, and resolution status.

---

## Cost Governance

| Concept | Description |
|---|---|
| **Credit system** | Users have a credit wallet; generation jobs debit credits |
| **Cost estimation** | Before launching batch generation, estimated cost is computed |
| **Budget ceilings** | Projects can have a maximum spending limit |
| **Cost modes** | `preview_first` (cheap providers first), `premium_first` (best quality first), `strict_budget` (hard cap) |
| **Hard stop** | If budget is exhausted, generation halts (no silent overspend) |
| **Downgrade path** | Under budget pressure, system can route to cheaper providers |
| **Ledger** | All credits debited/credited are logged with reason and reference |

---

## Diagnostics & QC

### QC Reports

Generated per episode/export with pass/fail results across multiple dimensions (visual quality, continuity, audio, format compliance). QC failure blocks export.

### Diagnostics Hub

- **Anomaly events**: Every detected aberration logged with category, severity, explanation
- **Provider fallback log**: When and why the system switched providers
- **Clip candidate rankings**: Why a particular candidate was selected over alternatives
- **Incident feed**: Active and resolved incidents with root cause classification
- **Blocking vs non-blocking**: Clear distinction between issues that halt the pipeline and warnings

### Export Readiness

Final export readiness is a composite check:
- All review gates passed (not stale)
- QC report passes all required dimensions
- No blocking anomalies unresolved
- Budget not exceeded
- All required assets present

---

## Data Model Overview

### Content Hierarchy

```
projects
  └── series → seasons → episodes → scenes → episode_shots
  └── (film) scenes → episode_shots
  └── (music_video) audio_analysis → sections → shots
```

### Key Table Groups

| Group | Tables |
|---|---|
| **Content** | `projects`, `series`, `seasons`, `episodes`, `scenes`, `scripts`, `bibles`, `character_profiles`, `character_reference_packs` |
| **Ingestion** | `source_documents`, `source_document_chunks`, `source_document_entities`, `source_document_mappings`, `source_document_autofill_runs`, `field_provenance` |
| **Canonical** | `canonical_fields`, `canonical_conflicts`, `inferred_completions`, `ingestion_runs` |
| **Generation** | `episode_shots`, `project_assets`, `asset_normalization_results` |
| **Validation** | `asset_validations`, `anomaly_events`, `aberration_categories` |
| **Timeline** | `timelines`, `timeline_tracks`, `timeline_clips` |
| **Review** | `approval_steps`, `approval_decisions`, `review_gates` |
| **Continuity** | `continuity_groups`, `continuity_conflicts`, `continuity_memory_nodes`, `continuity_memory_edges`, `continuity_reports` |
| **Export** | `export_versions`, `export_presets`, `export_jobs`, `delivery_manifests` |
| **Governance** | `governance_policies`, `governance_transitions`, `governance_violations`, `audit_logs`, `incidents`, `diagnostic_events` |
| **Cost** | `credit_wallets`, `credit_ledger` |
| **Agents** | `agent_registry`, `agent_runs`, `agent_outputs`, `agent_prompts` |
| **System** | `feature_flags`, `profiles`, `user_roles` |

---

## Frontend & UX

### Design Philosophy

The frontend is designed as a **production studio interface**, not a consumer app. It uses a dark-mode-first, content-dense layout with semantic design tokens, shadcn/ui components, and framer-motion animations.

### Key Screens

| Screen | Purpose |
|---|---|
| **Homepage** | Product positioning as a full AI audiovisual studio |
| **Dashboard** | Project overview with status, progress, and quick actions |
| **Create Project** | Unified creation wizard for all project types |
| **Series / Film / Music Video View** | Project-specific management with lifecycle tabs |
| **Documents Center** | Multi-file upload, document classification, canonical truth, conflicts, knowledge graph |
| **Timeline Studio** | Multi-track timeline editor with clip management |
| **Review Gates** | Gate-by-gate approval interface |
| **Finishing Panel** | Look preset selection, audio normalization, subtitle config |
| **Export Center** | Versioned export management with QC status |
| **Governance Dashboard** | Policy violations, incidents, project health |
| **Diagnostics** | Anomaly events, provider fallbacks, clip rankings |
| **Settings** | Account, preferences, API configuration |

### UX Principles

- Every UI screen maps to a real lifecycle step
- No orphan screens disconnected from the production pipeline
- Status labels and badges use consistent vocabulary across the app
- Context-aware navigation adapts to project type and lifecycle stage

---

## Key Jobs & Orchestration

### Edge Functions

| Function | Purpose |
|---|---|
| `import-document` | Document upload, AI classification, entity extraction, conflict detection, missing info detection, contextual retrieval |
| `create-project` | Project initialization with type-specific scaffolding |
| `create-series` | Series creation with season/episode structure |
| `plan-project` | AI-assisted project planning from ingested corpus |
| `generate-shots` | Shot generation with provider routing |
| `check-shot-status` | Poll provider APIs for generation completion |
| `validate-asset` | Multi-pass asset validation |
| `assemble-rough-cut` | Auto-assembly of validated shots into timeline |
| `batch-render` | Batch processing of render jobs |
| `stitch-render` | Final render stitching from timeline |
| `delivery-qc` | QC report generation |
| `export-assets` | Export file generation with format presets |
| `continuity-check` | Cross-episode/scene continuity validation |
| `estimate-cost` | Pre-generation cost estimation |
| `run-agent` | Execute AI agent with retry and scoring |
| `autopilot-run` | Full pipeline orchestration for an episode |
| `provider-health` | Provider availability monitoring |
| `system-health` | Platform health check |
| `workflow-pause` / `resume` / `cancel-safe` | Workflow lifecycle management |

### Orchestration Rules

- Jobs are **resumable** — failures can be retried without full restart
- Adding new files triggers **incremental re-ingestion**, not full reset
- State transitions are **idempotent** — duplicate calls produce the same result
- All jobs log to `audit_logs` for traceability

---

## Cloud, Security & Operations

### Security Invariants

| Rule | Enforcement |
|---|---|
| No API keys in frontend code | All provider calls via Edge Functions |
| Secrets in Lovable Cloud only | Never in `.env`, never in source code |
| RLS on all tables | Every table has Row Level Security policies |
| JWT validation in every Edge Function | Auth header checked before any operation |
| Service role key server-side only | Never exposed to client |
| Audit trail | Sensitive actions logged to `audit_logs` |

### Storage Buckets

| Bucket | Public | Purpose |
|---|---|---|
| `source-documents` | No | Uploaded project files |
| `face-references` | No | Character identity reference images |
| `audio-uploads` | No | Audio files for music video workflows |
| `shot-outputs` | Yes | Generated shot images/videos |
| `renders` | Yes | Final rendered outputs |

### Operational Rules

- Logs and incidents are surfaced in the Diagnostics Hub
- Failed jobs are automatically retried up to `max_retries`
- Cleanup policies handle orphaned assets and expired data
- Feature flags gate new functionality for staged rollout

---

## Development & Contribution Guidelines

### System Thinking

Before modifying any subsystem, understand how it connects to the lifecycle:

1. **Ingestion** feeds **canonical fields** which feed **scene planning** which feeds **generation**
2. **Generation** feeds **validation** which feeds **assembly** which feeds **review gates**
3. **Review gates** govern **finishing** which governs **export**

### Rules for Contributors

- **Preserve governance**: Do not bypass state machines or skip review gates
- **Preserve validation**: Do not add generation paths that skip anti-aberration checks
- **Preserve canonical truth**: Do not introduce parallel truth stores that conflict with `canonical_fields`
- **Preserve routing**: Do not add provider calls without going through the routing matrix
- **Preserve QC**: Do not add export behavior that bypasses QC checks
- **Preserve audit**: Log meaningful state changes to `audit_logs`
- **Preserve RLS**: Every new table must have Row Level Security policies
- **No orphan UI**: Every new screen must connect to a real lifecycle step

### Local Development

```bash
# Install dependencies
npm install

# Start dev server (port 8080)
npm run dev

# Type checking
npm run typecheck

# Run tests
npm run test

# Full CI check
npm run ci        # typecheck + lint + tests
```

### Testing

Tests cover: pipeline state machine, agent orchestration, review gates, continuity validation, confidence scoring, document ingestion logic, provider matrix resolution, quality scoring.

```bash
npm run test           # All tests
npm run test:unit      # Unit tests
npm run test:e2e       # E2E pipeline tests
```

---

## Roadmap & Feature Flags

### Current Feature Flags

Feature flags are stored in the `feature_flags` table and checked via `useFeatureFlag` hook. New capabilities are gated behind flags for staged rollout.

### Planned Extensions

| Area | Description | Status |
|---|---|---|
| Advanced manual editing | Frame-level trim, cross-dissolve, speed ramp | Planned |
| XML/EDL export | Industry-standard timeline interchange formats | Planned |
| Collaboration | Multi-user comments and annotations on timeline | Planned |
| Advanced subtitles | SRT/VTT generation, multi-language, styled captions | Planned |
| Higher-end finishing | LUT import, color grading curves, grain overlays | Planned |
| Stronger multimodal judges | Video-native validation (not frame-sampled) | Planned |
| Deeper hybrid workflows | AI-augmented editing of user-uploaded footage | Planned |
| Real-time preview | Live preview of timeline with finishing applied | Planned |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript 5, Vite 5, Tailwind CSS 3, shadcn/ui |
| Backend | Lovable Cloud (Supabase: PostgreSQL, Auth, Edge Functions, Storage, Realtime) |
| AI Gateway | Lovable AI (Gemini, GPT models) for extraction, analysis, validation |
| Generation | Google Veo, Runway Gen-4.5 / Act-Two / Aleph, Luma Photon / Ray / Reframe, OpenAI GPT Image |
| Payments | Stripe (subscriptions, credit top-ups) |
| Tests | Vitest |

---

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url>
cd saga-studio
npm install

# 2. Configuration
cp .env.example .env
# Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY

# 3. Development
npm run dev        # Dev server on port 8080
npm run test       # Run tests
npm run typecheck  # TypeScript check
npm run ci         # Full CI suite
```

---

## Documentation Index

| Document | Path | Description |
|---|---|---|
| Architecture | [docs/architecture.md](docs/architecture.md) | System architecture details |
| Agents | [docs/agents.md](docs/agents.md) | AI agent registry and configuration |
| Autopilot | [docs/autopilot.md](docs/autopilot.md) | Automated pipeline orchestration |
| Continuity | [docs/continuity.md](docs/continuity.md) | Cross-episode continuity memory system |
| Delivery | [docs/delivery.md](docs/delivery.md) | Delivery pipeline and QC |
| Security | [docs/security.md](docs/security.md) | Security policies and practices |
| Runbooks | [docs/runbooks.md](docs/runbooks.md) | Operational procedures |
| Document Ingestion | [docs/document-ingestion.md](docs/document-ingestion.md) | Import pipeline and autofill |
| Autofill | [docs/autofill.md](docs/autofill.md) | Intelligent field pre-population |
| Provider Matrix | [docs/PROVIDER_MATRIX.md](docs/PROVIDER_MATRIX.md) | Provider capabilities and routing |
| Export Matrix | [docs/EXPORT_MATRIX.md](docs/EXPORT_MATRIX.md) | Export formats and presets |
| Pipeline States | [docs/PIPELINE_STATES.md](docs/PIPELINE_STATES.md) | State machine definitions |
| Quality Standards | [docs/QUALITY_STANDARDS.md](docs/QUALITY_STANDARDS.md) | Validation thresholds and rules |
| Music Video Mode | [docs/MUSIC_VIDEO_MODE.md](docs/MUSIC_VIDEO_MODE.md) | Music video workflow specifics |
