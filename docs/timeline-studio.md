# Timeline Studio — NLE Architecture

## Overview

The Timeline Studio is a browser-based NLE (Non-Linear Editor) inspired by DaVinci Resolve. It provides real media previews, clip-level editing, and end-to-end export.

## Data Flow

```
Shots (generated) → assemble-rough-cut → timeline_clips (with source_url)
                                              │
                              ┌────────────────┼────────────────┐
                              ▼                ▼                ▼
                       TimelineView      ClipPreviewDrawer   ExportPanel
                    (thumbnails,        (full preview,       (stitch-render,
                     playhead,           metadata,           progress,
                     track lanes)        trim controls)      download)
```

## Key Tables

| Table | Purpose |
|-------|---------|
| `timelines` | Timeline metadata per project |
| `timeline_tracks` | Audio/video tracks within a timeline |
| `timeline_clips` | Individual clips with `source_url`, position, duration |
| `shots` | Generated shots for projects |
| `episode_shots` | Generated shots for episodes |
| `export_versions` | Export render history |
| `renders` | Active render jobs |

## `assemble-rough-cut` Edge Function

Populates `timeline_clips` from shots:
- `source_url` ← `shot.output_url` or `episode_shot.output_url`
- `shot_id` ← for project shots
- `episode_shot_id` ← for episode shots
- Clips ordered by shot index, distributed across tracks

## Frontend Components

### TimelineView (`src/components/studio/TimelineView.tsx`)
- Real thumbnails for each clip (image/video poster)
- Track lanes at 100px height
- Time ruler with configurable scale
- Playhead indicator
- Click-to-select clips → opens ClipPreviewDrawer

### ClipPreviewDrawer (`src/components/studio/ClipPreviewDrawer.tsx`)
- Full-size video/image preview with playback controls
- Metadata display: provider, model, duration, score
- Lock/unlock toggle

### ExportPanel (`src/components/studio/ExportPanel.tsx`)
- Invokes `stitch-render` edge function
- Real-time progress via Supabase subscription on `export_versions`
- Download links for completed renders

### ShotPreviewPlayer (Program Monitor)
- Master preview viewport in TimelineStudio
- Shows current shot/clip at full size
- Progressive display: shots appear as they complete generation

## Real-Time Features

- **Progressive shot display**: Subscribes to `shots` table changes, shows thumbnails as generation completes
- **Export progress**: Subscribes to `export_versions` for render status updates
- **Clip updates**: Timeline refreshes when clips are modified

## Export Pipeline

```
User clicks Export → ExportPanel → stitch-render edge function
  → Reads timeline_clips with source_url
  → Beat-sync (if audio analysis exists)
  → Multi-format render (16:9, 9:16, 1:1)
  → Upload to renders bucket
  → Update export_versions with output_url
  → UI shows download link
```
