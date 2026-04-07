
# Production-Grade AI Studio — Implementation Plan

## Audit Summary: What Already Exists ✅

| Module | Status | Notes |
|--------|--------|-------|
| Project creation (clip/film/music_video/series) | ✅ Exists | Separate pages, no unified wizard |
| Series flow (seasons/episodes/scenes) | ✅ Exists | Full CRUD, scene breakdown UI |
| Bibles & character profiles | ✅ Exists | Editor + cards, linked to series |
| Provider registry (15 models) | ✅ Exists | Modular config: registry, matrix, resolver, pipelines |
| Pipeline state machine (13 states) | ✅ Exists | Transitions, resume points, error codes |
| Edge functions (generate-shots, check-shot-status, pipeline-worker) | ✅ Exists | Multi-provider with fallback |
| FFmpeg client-side render | ✅ Exists | Full wasm renderer with progress |
| Shot preview player | ✅ Exists | Cinema-quality player with keyboard shortcuts |
| Scene breakdown | ✅ Exists | Duration tracking, scene list |
| Approval inbox | ✅ Exists | Approval steps + decisions |
| Continuity center | ✅ Exists | Memory nodes/edges, conflicts, reports |
| Delivery center | ✅ Exists | Manifests, QC reports |
| Agent orchestration | ✅ Exists | Agent registry, runs, outputs |
| Credit system | ✅ Exists | Wallets, ledger, debit/topup |
| Auth + RLS | ✅ Exists | Full user isolation |

## What's Missing ❌

| Module | Status | Required For |
|--------|--------|-------------|
| Timeline engine (tracks, clips, versions) | ❌ Missing | Core editing |
| Auto-assembly engine | ❌ Missing | Rough/fine cut |
| Review gates as first-class entities | ❌ Partial | Approval workflow |
| Continuity groups | ❌ Missing | Visual consistency |
| Finishing / look harmonization | ❌ Missing | Export quality |
| Export versioning | ❌ Missing | Version history |
| Provider payload logging | ❌ Missing | Debugging |
| Unified project wizard | ❌ Missing | UX |
| Hybrid video flow | ❌ Missing | P1 feature |
| Film long-form support | ❌ Partial | Film limited to 6min |

---

## Phase 1: Database Schema Foundation
**Creates the backbone tables for timeline, assembly, and export.**

### New tables:
- `timelines` — project timeline with version tracking (project_id, version, name, status, duration_sec)
- `timeline_tracks` — individual tracks within a timeline (timeline_id, type: video/dialogue/music/fx/subtitles, idx, label, muted, locked)
- `timeline_clips` — clips placed on tracks (track_id, asset_id, scene_id, start_time_ms, end_time_ms, in_trim_ms, out_trim_ms, provider, model, locked, status)
- `continuity_groups` — groups for visual consistency (series_id, name, preset_refs jsonb)
- `export_versions` — versioned exports (project_id, timeline_id, version, format, resolution, status, output_url, look_preset)
- `review_gates` — explicit validation checkpoints (project_id, episode_id, gate_type, status, decided_by, decided_at)
- `provider_payload_logs` — debug logs for provider calls (shot_id, provider, model, payload_sent, response_metadata, latency_ms)
- `project_assets` — unified asset registry (project_id, asset_type, source_provider, url, metadata)

### Modifications:
- `scenes` — add `continuity_group_id` FK
- `projects` — update `provider_default` default from 'sora2' to null

### RLS:
- All new tables get user-ownership policies via project → user chain

---

## Phase 2: Unified Project Wizard + Character/World Builder
**Single entry point for all project types with identity setup.**

### UI:
- `/create` — New unified wizard page replacing individual create pages
  - Step 1: Project type selector (series/film/music_video/hybrid_video)
  - Step 2: Brief intake (title, synopsis, duration, aspect ratio, audio upload for music_video, video upload for hybrid)
  - Step 3: Visual tone & quality tier
  - Step 4: Character/world seed (upload images or generate from prompt)
  - Step 5: Confirm & launch

### Backend:
- Update `create-project` edge function to handle all types uniformly
- Add `build_character_pack` and `build_world_pack` job types to orchestration

### Logic:
- No generation before character/world approval (enforced via review gate)
- Character pack saved to `project_assets` for downstream injection

---

## Phase 3: Scene Planner + Job Orchestration Enhancement
**Enhance scene planning and make jobs resumable per-scene.**

### UI:
- Enhanced scene planner in episode view
  - Add/edit/reorder scenes inline
  - Auto-suggest scenes from brief (via AI)
  - Assign continuity groups
  - Per-scene regeneration button

### Backend:
- New job types: `generate_scene_clips`, `generate_performance_clips`, `generate_hero_shots`, `transform_clips`
- Each job tied to a specific scene_id
- Failed scene jobs don't block other scenes
- Job dashboard shows per-scene/per-project progress

### Edge functions:
- Update `pipeline-worker` to run scene-by-scene with review gate pauses
- Add scene-level retry capability

---

## Phase 4: Timeline Engine + Auto-Assembly
**The core differentiator — real timeline with auto-assembly.**

### Backend:
- `assemble-rough-cut` edge function:
  - For series/film: assemble by scene order using approved clips
  - For music_video: assemble according to beat map
  - Creates timeline + tracks + clips automatically
  - Respects scene target durations
  - Fills gaps with fallback logic

### UI: Timeline Studio (`/project/:id/timeline`)
- Left panel: scene list
- Center: preview player (reuse existing)
- Bottom: multi-track timeline visualization
  - Video track with clip thumbnails
  - Music track (waveform if audio exists)
  - Markers for scene boundaries
- Right panel: clip inspector
- Interactions:
  - Click to select clip
  - Drag to reorder (within scene constraints)
  - Replace single clip (triggers regeneration)
  - Lock clip (prevents changes)
  - Trim in/out points

### Timeline versions:
- "Create fine cut" = clone current timeline as new version
- Compare rough cut vs fine cut

---

## Phase 5: Review Gates + Finishing Layer
**Explicit validation checkpoints and look harmonization.**

### Review Gates:
- Gate types: `character_pack`, `world_pack`, `scene_plan`, `clips`, `rough_cut`, `fine_cut`, `final_export`
- Actions: approve, reject, regenerate, replace_shot, lock, switch_provider
- No downstream generation before upstream approval
- UI in timeline studio sidebar

### Finishing / Look Harmonization:
- Project look presets: `cinematic_soft`, `crisp_modern`, `dramatic_contrast`, `glossy_music_video`, `clean_neutral`
- Each preset = CSS filter values + FFmpeg filter chain
- "Apply Project Look" button in finishing panel
- Applied during export (not destructive to source clips)
- Audio normalization (basic loudness matching)
- Optional title card / watermark

### UI: Finishing Panel (tab in timeline studio)
- Preset picker with live preview
- Brightness/contrast/saturation sliders
- Grain/sharpen toggles
- Audio level meters

---

## Phase 6: Export Engine + Polish
**Final export pipeline with versioning.**

### Export Engine:
- `build-final-export` edge function
- Outputs:
  - MP4 1080p master (with look preset applied)
  - MP4 preview (720p)
  - Vertical 9:16 derivative (via Luma Reframe or FFmpeg crop)
  - Poster still (via GPT Image 1.5 or frame extract)
  - Thumbnail
- All exports versioned in `export_versions` table
- Export history visible in UI
- Previous versions preserved

### UI: Export Center (tab in project view)
- Format selector with previews
- Export progress with real-time status
- Download history
- One-click "Export Final Master"

### Polish:
- Update Dashboard to show timeline progress
- Update film creation to support long-form (remove 6min cap)
- Add hybrid video upload flow (P1)
- Provider payload logs visible in diagnostics tab

---

## Implementation Order

| Phase | Priority | Depends On | Estimated Scope |
|-------|----------|------------|-----------------|
| Phase 1: DB Schema | P0 | Nothing | Migration only |
| Phase 2: Project Wizard | P0 | Phase 1 | 3-4 new files |
| Phase 3: Scene Planner | P0 | Phase 1 | 2-3 files + edge fn updates |
| Phase 4: Timeline Engine | P0 | Phase 1, 3 | 5-6 new files (biggest phase) |
| Phase 5: Review Gates + Finishing | P0 | Phase 4 | 3-4 files + edge fn |
| Phase 6: Export Engine | P0 | Phase 4, 5 | 2-3 files + edge fn |

**Total new files**: ~20-25 components/pages/hooks
**Total modified files**: ~10-15 existing files
**New edge functions**: 3-4
**DB migrations**: 1 large migration

---

## What We Preserve (No Breaking Changes)

- All existing create pages remain functional (wizard is additive)
- Existing shot generation pipeline untouched
- Existing series/episode/scene flow preserved
- FFmpeg client renderer preserved
- All existing RLS policies preserved
- Credit system untouched
- Provider registry/matrix/resolver preserved
