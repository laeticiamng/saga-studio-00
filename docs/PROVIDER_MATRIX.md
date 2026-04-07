# Provider Matrix — Saga Studio

## Principle

Every generation request **MUST** pass through the centralized provider resolution (`src/config/providers/`). No direct provider calls are allowed outside this system.

## Architecture

The provider system is split into focused modules:
- `src/config/providers/types.ts` — Type definitions
- `src/config/providers/registry.ts` — Static catalog of all models
- `src/config/providers/matrix.ts` — Mode × Tier → allowed providers
- `src/config/providers/resolver.ts` — Selection logic
- `src/config/providers/pipelines.ts` — Step-by-step pipeline definitions
- `src/config/providers/index.ts` — Public API

## Active Providers

### Google
| Name | Model ID | Type | Role |
|------|----------|------|------|
| `google_nano_banana_2` | `gemini-3.1-flash-image-preview` | Image | Fast exploration, variants |
| `google_nano_banana_pro` | `gemini-3-pro-image-preview` | Image | Premium design packs, canonical assets |
| `google_veo_31` | `veo-3.1-generate-preview` | Video | Hero shots, prestige plans, 8s 1080p |
| `google_veo_31_lite` | `veo-3.1-lite-generate-preview` | Video | Cheaper video iterations |

### Runway
| Name | Model ID | Type | Role |
|------|----------|------|------|
| `runway` | `gen4.5` | Video | Narrative backbone (series/film), 2–10s |
| `runway_act_two` | `act_two` | Video | Performance capture, acting |
| `runway_aleph` | `gen4_aleph` | Video | Video transform, style transfer, repair |

### Luma
| Name | Model ID | Type | Role |
|------|----------|------|------|
| `luma_photon` | `photon-1` | Image | Identity pack, character/style ref |
| `luma_photon_flash` | `photon-flash-1` | Image | Fast image variants |
| `luma` | `ray-2` | Video | Utility, fallback video |
| `luma_reframe` | `reframe` | Utility | Aspect ratio derivatives (9:16, etc.) |
| `luma_modify` | `modify_video` | Utility | Video-to-video transformation |

### OpenAI
| Name | Model ID | Type | Role |
|------|----------|------|------|
| `openai_image` | `gpt-image-1.5` | Image | Posters, covers, text cards, marketing |

### Legacy / Deprecated
| Name | Model ID | Status | Note |
|------|----------|--------|------|
| `sora2` | `sora-2` | LEGACY | API shutdown Sept 2026 |
| `google_veo` | `veo-3.0-generate-preview` | DEPRECATED | Announced shutdown |

## Matrix — Mode × Tier

| Mode | Tier | Video Providers (priority) | Render Target |
|------|------|---------------------------|---------------|
| `series` | `premium` | Runway → Veo 3.1 → Act-Two | server_required |
| `series` | `standard` | Runway → Veo 3.1 → Luma → Veo Lite | server_preferred |
| `series` | `economy` | Luma → Veo Lite → GPT Image → Nano Banana | browser_allowed |
| `film` | `premium` | Runway → Veo 3.1 → Act-Two | server_required |
| `film` | `standard` | Runway → Veo 3.1 → Luma → Veo Lite | server_preferred |
| `film` | `economy` | Luma → Veo Lite → GPT Image → Nano Banana | browser_allowed |
| `music_video` | `premium` | Veo 3.1 → Runway → Act-Two | server_required |
| `music_video` | `standard` | Veo 3.1 → Runway → Veo Lite → Luma | server_preferred |
| `music_video` | `economy` | Veo Lite → Luma → GPT Image → Nano Banana | browser_allowed |
| `clip` | `premium` | Runway → Veo 3.1 | server_required |
| `clip` | `standard` | Runway → Veo 3.1 → Luma → Veo Lite | server_preferred |
| `clip` | `economy` | Luma → Veo Lite → GPT Image → Nano Banana | browser_allowed |

## Pipeline Architecture

Each workflow type has an optimal pipeline of sequential steps:

### Series
Photon/Nano Banana Pro → World Pack → **Runway Gen-4.5** (backbone) → Act-Two → **Veo 3.1** (hero) → Aleph (repair) → Reframe → GPT Image 1.5

### Film
Photon/Nano Banana Pro → Film Bible → **Runway Gen-4.5** (backbone) → Act-Two → **Veo 3.1** (prestige) → Aleph (repair) → GPT Image 1.5

### Music Video
Photon/Nano Banana → Nano Banana Pro → **Veo 3.1** (backbone) → Act-Two → Aleph → Reframe → GPT Image 1.5

## Rules

1. **Premium modes** never accept image-only fallback
2. **Silent fallback** = degradation without user notification = strictly forbidden for premium/standard
3. **server_required** = final export MUST go through server rendering
4. When no provider is available for a premium mode → **hard block** with clear error
5. All fallback decisions are logged in the project's decision log
6. Route by **capability** (image, video, transform, reframe, performance), not by brand
