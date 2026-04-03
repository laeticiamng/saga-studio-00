
# Ticket Maître — Plan d'exécution

## Phase 1 : P0 — Bloquants Prod

### P0.1 — Mode `music_video` explicite
- Ajouter `music_video` au type enum projet (migration DB)
- Créer `src/pages/CreateMusicVideo.tsx` avec formulaire spécialisé (clip type, artist presence, refs, style)
- Ajouter route `/create/music-video`
- Adapter `ProjectView` pour afficher le type correctement
- Labels UI distincts pour chaque mode

### P0.2 — Matrice provider stricte
- Créer `src/config/providerMatrix.ts` : providers autorisés par mode × qualité
- Créer `docs/PROVIDER_MATRIX.md`
- Intégrer la résolution provider dans `generate-shots` et `pipeline-worker`
- Bloquer fallback silencieux pour modes premium
- UI : afficher provider réel + mode de rendu dans ProjectView/Diagnostics

### P0.3 — Rendu serveur obligatoire pour exports premium
- Ajouter notion `render_target` (server_required / server_preferred / browser_allowed)
- Adapter `RenderExportPanel` : distinguer preview locale vs master final
- Pour `music_video` premium → server_required
- Renforcer queue de rendu + reprise idempotente + journal

### P0.4 — Machine d'état pipeline stricte
- Créer `src/lib/pipeline-state-machine.ts` avec états, transitions, validations
- Créer `docs/PIPELINE_STATES.md`
- Intégrer dans hooks et edge functions
- Refuser transitions illégales, codifier erreurs
- Reprise depuis dernier jalon stable

### P0.5 — Tests E2E d'intégration
- Créer 8 scénarios E2E réels (happy path, face refs, no provider, render failure, credits, bad URL, multi-format, retry)
- Refactorer le fichier test existant en modules focalisés

## Phase 2 : P1 — Qualité Premium

### P1.1 — Storyboard preview avant génération
### P1.2 — Quality scoring automatique (`src/lib/quality-scoring.ts`)
### P1.3 — Continuity validator (`src/lib/continuity-validator.ts`)
### P1.4 — Sync musicale native (`src/lib/music-structure.ts`)
### P1.5 — Dashboard observabilité admin

## Phase 3 : P2 — Ambition
### P2.1 — Personas créatifs
### P2.2 — Presets clip métier
### P2.3 — Asset governance

---

**Approche** : On attaque P0.1 → P0.4 en parallèle (code + docs + migration), puis P0.5 (tests), puis P1 bloc par bloc.
