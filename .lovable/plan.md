

# Plan: Real Studio Renders & End-to-End Preview Pipeline

## Problem Statement

The Studio (Timeline Studio) currently shows only **colored rectangles** for clips — no thumbnails, no video previews, no media at all. This is nothing like DaVinci Resolve. Additionally, several data flow gaps prevent the end-to-end render pipeline from working correctly:

1. **`assemble-rough-cut` doesn't populate `source_url`** — clips are inserted without any media reference, so the UI has nothing to show
2. **`TimelineView` has no media rendering** — it only draws CSS rectangles with text labels
3. **No shot preview in Studio** — the `ShotPreviewPlayer` exists in `ProjectView` but is absent from `TimelineStudio`
4. **No clip-level preview** — clicking a clip in the timeline shows nothing
5. **`assemble-rough-cut` doesn't link clips to shots** — `shot_id` and `episode_shot_id` columns exist but are never set
6. **Export from Studio uses `export_versions` table** — but `ExportPanel` only inserts DB rows, no actual render is triggered (no edge function called)
7. **No visual feedback during generation** — while shots generate, there's no progressive thumbnail display in Studio

---

## Implementation

### 1. Fix `assemble-rough-cut` to populate media URLs

In `supabase/functions/assemble-rough-cut/index.ts`, when building `clipInserts`, populate:
- `source_url` from `shot.output_url` (for project shots) or `episode_shot.output_url` (for episode shots)
- `shot_id` for project shots
- `episode_shot_id` for episode shots

This is the root cause — without `source_url`, the entire downstream preview chain is broken.

### 2. Rebuild `TimelineView` with real media previews

Transform `src/components/studio/TimelineView.tsx` from a simple rectangle renderer into a proper NLE-style timeline:
- Each clip shows a **thumbnail** (first frame extracted from `source_url`, or the image itself for image shots)
- Clips display as video/image thumbnails inside the track lane, sized proportionally
- Clicking a clip opens a **preview drawer** showing the video/image at full size with playback controls
- Track lanes become taller (~80px) to accommodate visual previews
- Add a playhead indicator

### 3. Add `ShotPreviewPlayer` to Timeline Studio

In `src/pages/TimelineStudio.tsx`, add the existing `ShotPreviewPlayer` component as a preview viewport above the timeline (like the Program Monitor in Premiere/DaVinci). Fetch project shots and wire them in.

### 4. Add clip detail drawer/modal

Create a new component `src/components/studio/ClipPreviewDrawer.tsx`:
- Shows when user clicks a clip in the timeline
- Displays the clip's video/image from `source_url`
- Shows metadata: provider, model, duration, score
- Allows trimming (in/out points) via `in_trim_ms`/`out_trim_ms`
- Lock/unlock toggle

### 5. Wire Studio Export to actual render

In `src/components/studio/ExportPanel.tsx`:
- When user clicks an export button, invoke `stitch-render` edge function (not just insert a DB row)
- Show progress via realtime subscription on the `renders` table
- Display download links when render completes

### 6. Progressive shot display during generation

In `TimelineStudio`, subscribe to realtime changes on the `shots` table for the project. As shots complete (status → `completed` with `output_url`), show them progressively in a thumbnail strip or within the timeline tracks.

---

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/assemble-rough-cut/index.ts` | Populate `source_url`, `shot_id`, `episode_shot_id` in clip inserts |
| `src/components/studio/TimelineView.tsx` | Full rewrite: thumbnail clips, click-to-preview, playhead, taller tracks |
| `src/components/studio/ClipPreviewDrawer.tsx` | New: clip detail panel with video player, metadata, trim controls |
| `src/pages/TimelineStudio.tsx` | Add shot preview player (Program Monitor), shot query, realtime subscription for progressive display |
| `src/components/studio/ExportPanel.tsx` | Wire export buttons to `stitch-render` edge function, show render progress and download links |

## Technical Notes

- `timeline_clips.source_url` column already exists — just needs to be populated
- `shot_id` and `episode_shot_id` FK columns already exist on `timeline_clips`
- No database migration needed
- Shots `output_url` points to public `shot-outputs` bucket (already public) or external provider URLs
- The `ShotPreviewPlayer` component already handles both image and video `output_url` formats
- `stitch-render` already handles the full render pipeline (beat-sync, multi-format) — it just needs to be called from the Studio export panel

