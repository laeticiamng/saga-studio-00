

# Audit Complet — Saga Studio Platform Hardening

## Diagnostic Summary

After auditing all edge functions, pipelines, provider integrations, governance engine, and data flows across the 4 production modes (Series, Film, Music Video, Clip), I identified **19 issues** across 6 categories.

---

## CATEGORY 1 — Critical Bugs (Production-Breaking)

### 1.1 `analyze-audio` uses WRONG API URL
**File**: `supabase/functions/analyze-audio/index.ts` line 42
**Bug**: Uses `https://ai.lovable.dev/api/generate` instead of `https://ai.gateway.lovable.dev/v1/chat/completions`
**Impact**: Audio analysis silently fails for every project → fallback BPM 120 always used → beat-sync and section detection are fake data
**Fix**: Update URL to `https://ai.gateway.lovable.dev/v1/chat/completions` and align request body format

### 1.2 `create-project` rejects `music_video` type
**File**: `supabase/functions/create-project/index.ts` line 55
**Bug**: Validates `["clip", "film", "series"]` — missing `music_video`. The frontend sends `music_video` but it's rejected with "Invalid project type"
**Impact**: Music video projects cannot be created via the standard flow
**Fix**: Add `"music_video"` to the allowed types array

### 1.3 `hybrid_video` maps to `"film"` type silently
**File**: `src/pages/CreateProject.tsx` line 385
**Bug**: `projectType === "hybrid_video" ? "film"` — hybrid video is sent as `film` to the backend. No `hybrid_video` pipeline exists in `PROVIDER_MATRIX` or `PIPELINE_ROUTES`
**Impact**: Hybrid video has no dedicated pipeline, no upload-source-video step, no transform/stylize step via Aleph/Modify. It just runs as a regular film
**Fix**: Either (a) add `hybrid_video` as a proper mode with a pipeline in `pipelines.ts` and matrix entries, or (b) document it as a sub-mode of `film` and add the video-upload + transform steps conditionally

### 1.4 `run-agent` model reference uses bare `gemini-2.5-flash`
**File**: `supabase/functions/run-agent/index.ts` line 443
**Bug**: Uses `model: "gemini-2.5-flash"` instead of `model: "google/gemini-2.5-flash"` (the Lovable AI Gateway requires the `provider/` prefix)
**Impact**: All agent runs may fail or use wrong model routing
**Fix**: Change to `"google/gemini-2.5-flash"`

### 1.5 `plan-project` model reference uses bare `gemini-2.5-flash`
**File**: `supabase/functions/plan-project/index.ts` line 206
**Same issue** as 1.4
**Fix**: Change to `"google/gemini-2.5-flash"`

---

## CATEGORY 2 — Pipeline Gaps (Missing Steps)

### 2.1 No `Luma Reframe` provider implementation in `generate-shots`
**Status**: `luma_reframe` is in the pipeline definition and registry but has NO provider class in `generate-shots/index.ts`. If social export reframe step is triggered, it will silently skip
**Fix**: Add `LumaReframeProvider` class or route through Luma Modify

### 2.2 No `Luma Modify` provider implementation in `generate-shots`
**Status**: `luma_modify` is in the registry but no provider class exists for video-to-video transformation
**Fix**: Add `LumaModifyProvider` class

### 2.3 `Luma Photon Flash` missing from provider chain
**Status**: `luma_photon_flash` is in registry but not in `PROVIDER_PRIORITY` in `generate-shots` and has no factory in `buildProviderChain`
**Fix**: Add to priority chain and factory map

### 2.4 Music Video pipeline missing audio backbone step
**Pipeline**: The music video pipeline goes `identity_pack → lookdev → iconic_shots → acting → repair → social_exports → poster` — there's no explicit beat-sync or audio-driven shot timing step. The `stitch-render` function handles beat-sync at render time, but shot generation doesn't use audio analysis data to inform shot durations
**Fix**: Ensure `plan-project` passes audio section data into shot planning for music videos, verifying the prompt includes beat-aligned timings

### 2.5 No `validate-asset` call in pipeline flow
**Status**: The `validate-asset` edge function exists and is well-implemented, but nothing in the pipeline automatically calls it. Shots go from `generating` → `completed` without quality validation
**Fix**: After shot generation completes in `generate-shots`, automatically queue an `validate-asset` call for each completed shot, or add it as a pipeline step between generation and assembly

---

## CATEGORY 3 — Data Flow / Consistency Issues

### 3.1 Governance state machine vs Pipeline state machine disconnect
**Issue**: Two parallel state machines exist:
- `src/lib/pipeline-state-machine.ts` (13 states: draft → completed)
- `src/lib/governance-engine.ts` (18 states: draft → delivered)

The `projects` table has both `status` (pipeline) and `governance_state` columns, but they're never synchronized. Edge functions update `status` directly, governance engine updates `governance_state` — they can drift apart
**Fix**: Add a reconciliation layer: when pipeline status changes, update governance_state accordingly, or unify into a single state machine

### 3.2 Credit cost not mode-aware
**File**: `supabase/functions/generate-shots/index.ts` line 748
**Issue**: Credits are always `2 per shot` regardless of provider tier (premium Runway at 0.40/sec vs economy Nano Banana at 0.01). Premium projects should cost more
**Fix**: Look up `costPerSecond` from the provider registry and compute accurate credit costs

### 3.3 `create-project` doesn't persist `quality_tier`
**File**: `supabase/functions/create-project/index.ts`
**Issue**: The frontend sends quality tier selection but `create-project` never stores it. The `projects` table likely doesn't have a `quality_tier` column. Without it, the provider resolver can't enforce tier-specific rules
**Fix**: Add `quality_tier` column to projects table and persist it at creation

---

## CATEGORY 4 — Robustness / Error Handling

### 4.1 `check-shot-status` missing Nano Banana / Photon status checker
**File**: `supabase/functions/check-shot-status/index.ts`
**Issue**: Has checkers for Runway, Luma, Veo, Sora — but Nano Banana and Photon use synchronous generation (return URL directly). The `parseJobReference` function expects `job:provider:id` format but synchronous providers return URLs directly. If a shot is saved with a URL as `output_url` and status `generating`, it'll never be detected as complete
**Fix**: In `check-shot-status`, detect shots where `output_url` is a real URL (not a job reference) and mark them as completed immediately

### 4.2 No timeout/circuit-breaker on external provider calls
**Issue**: `generate-shots` has a 45s per-provider timeout, but no global request timeout. If the edge function processes 10 shots sequentially, total time can reach 450s, well beyond Deno edge function limits (~60-120s)
**Fix**: Process max 3-5 shots per invocation, then self-invoke for the remainder (similar to how `episode-pipeline` chains)

### 4.3 Export-assets doesn't verify render completeness
**File**: `supabase/functions/export-assets/index.ts`
**Issue**: Exports all renders for a series without checking if they're actually `completed`. Could export failed or in-progress renders
**Fix**: Add `.eq("status", "completed")` filter

---

## CATEGORY 5 — Missing Features Identified by Comparison

### 5.1 No image-to-video pipeline step
**Gap**: The pipeline supports `text_to_video` but not `image_to_video`. Runway Gen-4.5 supports this natively. This would allow using Photon/Nano Banana identity pack outputs as direct video generation inputs for character consistency
**Fix**: Add `image_to_video` as a capability to the pipeline flow, passing identity pack URLs as reference images to Runway

### 5.2 No batch retry/resume for failed shots
**Gap**: If 3 of 20 shots fail, the user must regenerate the entire project. There's no selective retry
**Fix**: Add a `retry_failed_shots` action in `generate-shots` that only re-processes shots with `status: "failed"`

---

## CATEGORY 6 — Security / Edge Cases

### 6.1 `plan-project` has no auth check
**File**: `supabase/functions/plan-project/index.ts`
**Issue**: No JWT validation — anyone with a project_id can trigger planning
**Fix**: Add auth header validation like other edge functions

---

## Implementation Plan (Priority Order)

### Phase 1 — Critical Fixes (blocks production)
1. Fix `analyze-audio` API URL
2. Fix `create-project` to accept `music_video` type
3. Fix `run-agent` and `plan-project` model name prefixes
4. Add auth check to `plan-project`

### Phase 2 — Pipeline Completeness
5. Add missing provider classes (Luma Reframe, Luma Modify, Photon Flash)
6. Wire `validate-asset` into the generation pipeline
7. Fix `check-shot-status` for synchronous providers
8. Add `quality_tier` to projects table and flow

### Phase 3 — Robustness
9. Fix batch size limits in `generate-shots` (max 3-5 per invocation)
10. Reconcile governance_state with pipeline status
11. Fix credit costs to be provider-aware
12. Add `.eq("status", "completed")` to `export-assets`
13. Add selective retry for failed shots

### Phase 4 — Feature Gaps
14. Add `hybrid_video` pipeline or document as film sub-mode
15. Add `image_to_video` reference passing from identity packs
16. Improve audio-driven shot timing for music videos

### Estimated scope
- ~15 files modified (mostly edge functions)
- 1 database migration (add `quality_tier` column)
- All edge functions redeployed

