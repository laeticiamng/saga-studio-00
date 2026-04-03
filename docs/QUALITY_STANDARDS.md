# Quality Standards — Saga Studio

## Shot Quality Dimensions

| Dimension | Weight | Description |
|-----------|--------|-------------|
| `face_consistency` | 20% | Same face across shots |
| `outfit_consistency` | 10% | Consistent clothing |
| `decor_consistency` | 10% | Consistent backgrounds |
| `color_palette` | 10% | Color harmony |
| `style_stability` | 15% | Visual style coherence |
| `sharpness` | 10% | Image clarity, no artifacts |
| `beat_match` | 15% | Aligned to musical rhythm |
| `section_relevance` | 10% | Matches musical section mood |

## Thresholds

| Threshold | Value | Action |
|-----------|-------|--------|
| `DEFAULT_THRESHOLD` | 0.65 | Minimum for `completed` status |
| `REVIEW_THRESHOLD` | 0.50 | Shot flagged for human review |
| `REGEN_THRESHOLD` | 0.35 | Shot auto-queued for regeneration |

## Rules

1. A premium `music_video` **cannot** reach `completed` if `globalScore < DEFAULT_THRESHOLD`
2. Shots below `REGEN_THRESHOLD` are regenerated automatically (up to 2 retries)
3. Shots between `REGEN_THRESHOLD` and `REVIEW_THRESHOLD` are flagged for review
4. All scores are visible in project diagnostics and admin dashboard
