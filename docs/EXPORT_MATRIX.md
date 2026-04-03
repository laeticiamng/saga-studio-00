# Export Matrix — Saga Studio

## Export Formats

| Format | Resolution | Use Case |
|--------|-----------|----------|
| `master_16_9` | 1920×1080 | YouTube, Vimeo, web |
| `master_9_16` | 1080×1920 | TikTok, Reels, Shorts |
| `teaser` | 1920×1080 | 15s highlight reel |
| `square` | 1080×1080 | Instagram feed |

## Render Targets

| Target | Description | When Used |
|--------|-------------|-----------|
| `server_required` | Final export must use server rendering | Premium music_video, premium clip/film |
| `server_preferred` | Server render preferred, browser fallback OK if flagged | Standard tier projects |
| `browser_allowed` | Browser FFmpeg assembly fully acceptable | Economy tier, dev/preview |

## Rules

1. Premium projects: `server_required` — browser render button hidden for final export
2. Standard projects: `server_preferred` — browser render available but flagged as "preview quality"
3. Economy projects: `browser_allowed` — full browser render access
4. Teaser always extracted from highest-energy sections
5. Multi-format export creates all selected formats in a single render pass
