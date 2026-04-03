# Music Video Mode — Saga Studio

## Overview

The `music_video` project type is a specialized workflow for generating premium music video clips from a finished audio track.

## Workflow

1. **Upload music** — MP3/WAV, max 4:30
2. **Audio analysis** — BPM, beat grid, sections (intro/verse/chorus/bridge/drop/outro), energy curve
3. **Clip type selection** — live, narrative, performance, hybrid
4. **Artist presence** — none, partial (some shots), full (every shot)
5. **References** — face refs, style refs, costume/decor refs
6. **Storyboard generation** — Beat-aligned cut plan with section mapping
7. **Pre-generation review** — User validates storyboard before costly generation
8. **Shot generation** — Provider-resolved, beat-synced shots
9. **Quality control** — Per-shot scoring + continuity check
10. **Render/Export** — Server-side for premium, multi-format output

## Clip Types

| Type | Description |
|------|-------------|
| `live` | Stage/concert performance, dynamic camera |
| `performance` | Studio/controlled performance, intimate |
| `narrative` | Story-driven with characters and arc |
| `hybrid` | Mix of performance and narrative |

## Artist Presence

| Level | Description |
|-------|-------------|
| `none` | Abstract/scenic, no artist shown |
| `partial` | Artist in some shots, mixed with scenery |
| `full` | Artist visible in every shot |

## Quality Tiers

| Tier | Video Source | Render | Fallback |
|------|------------|--------|----------|
| `premium` | Native video only (Runway/Luma) | Server required | None — blocks if unavailable |
| `standard` | Video preferred, image OK if flagged | Server preferred | Image sequence OK |
| `economy` | Any source | Browser OK | All fallbacks allowed |
