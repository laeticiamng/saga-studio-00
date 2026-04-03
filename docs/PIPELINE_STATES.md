# Pipeline States — Saga Studio

## State Machine

```
draft
  → validating_inputs
    → analyzing_audio
      → planning_storyboard
        → resolving_provider
          → generating_shots
            → quality_review
              → rendering
                → export_ready
                  → completed

Any active state → failed_retryable → resume from checkpoint
Any active state → failed_terminal (no recovery)
Any active state → cancelled
```

## States

| State | Legacy Equivalent | Description |
|-------|-------------------|-------------|
| `draft` | `draft` | Project created, not started |
| `validating_inputs` | `analyzing` | Checking audio, refs, credits |
| `analyzing_audio` | `analyzing` | BPM, sections, energy extraction |
| `planning_storyboard` | `planning` | Generating shot plan, style bible |
| `resolving_provider` | `planning` | Selecting provider via matrix |
| `generating_shots` | `generating` | Creating individual shots |
| `quality_review` | `generating` | Scoring shots, checking continuity |
| `rendering` | `stitching` | Server or client video assembly |
| `export_ready` | `completed` | Render done, exports available |
| `completed` | `completed` | Fully delivered |
| `failed_retryable` | `failed` | Can resume from last checkpoint |
| `failed_terminal` | `failed` | Unrecoverable failure |
| `cancelled` | `cancelled` | User cancelled |

## Error Codes

| Code | Description |
|------|-------------|
| E001 | Insufficient credits |
| E002 | No audio file |
| E003 | Invalid audio format |
| E004 | Provider unavailable |
| E005 | Provider rate limit |
| E006 | Provider policy violation |
| E007 | All shots failed |
| E008 | Render service down |
| E009 | Render timeout |
| E010 | Quality below threshold |
| E011 | Continuity violation |
| E012 | Invalid state transition |
| E999 | Unknown error |

## Resume Points

When a `failed_retryable` occurs, the system determines the last stable checkpoint:

| Failed At | Resume From |
|-----------|-------------|
| `validating_inputs` | `draft` |
| `analyzing_audio` | `draft` |
| `planning_storyboard` | `analyzing_audio` |
| `resolving_provider` | `planning_storyboard` |
| `generating_shots` | `resolving_provider` |
| `quality_review` | `generating_shots` |
| `rendering` | `generating_shots` |
