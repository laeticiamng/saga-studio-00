
# Refonte Provider Matrix & Pipelines

## Phase 1 — Registry & Types
- Mettre à jour `provider_registry` en DB avec tous les nouveaux modèles :
  - **Google** : `gemini-3.1-flash-image-preview` (Nano Banana 2), `gemini-3-pro-image-preview` (Nano Banana Pro), `veo-3.1-generate-preview`, `veo-3.1-lite-generate-preview`
  - **Runway** : `gen4.5` (garder), `act_two` (ajouter), `gen4_aleph` (ajouter)
  - **Luma** : `photon-1`, `photon-flash-1`, `ray-2` (garder), `ray-flash-2`, `reframe_video`, `modify_video`
  - **OpenAI** : `gpt-image-1.5` (remplace DALL-E 3 comme défaut)
  - **Retirer du cœur** : `sora-2` (legacy only), `veo-3.0-generate-preview` (shutdown)
- Ajouter les types : `ProviderCapability` (image_gen, video_gen, video_transform, image_reference, video_reframe, performance_capture)

## Phase 2 — Provider Matrix refactorisée
- Refactorer `src/config/providerMatrix.ts` en plusieurs fichiers :
  - `src/config/providers/types.ts` — types et interfaces
  - `src/config/providers/registry.ts` — registre statique des modèles et capacités
  - `src/config/providers/matrix.ts` — matrice mode×tier
  - `src/config/providers/resolver.ts` — logique de résolution
  - `src/config/providers/pipelines.ts` — définition des pipelines par workflow_type (series, film, music_video)
- Nouvelles règles de routage :
  - Par **capacité** (image, video, transform, reframe, performance) pas par marque
  - Pipeline en **étapes séquentielles** avec `user_gate` optionnel
  - Fallback chain par étape

## Phase 3 — Edge Functions
- Mettre à jour `generate-shots` pour supporter les nouveaux modèles Runway (gen4.5, act_two, gen4_aleph), Google (Veo 3.1, Nano Banana), Luma (photon-1, reframe), OpenAI (gpt-image-1.5)
- Mettre à jour `check-shot-status` pour les nouveaux endpoints de polling
- Marquer Sora 2 comme legacy (log warning si utilisé)
- Retirer `veo-3.0-generate-preview`

## Phase 4 — Pipeline Orchestrator
- Créer une nouvelle Edge Function `pipeline-orchestrator` qui :
  - Reçoit un `workflow_type` + `input_profile`
  - Calcule la route optimale (séquence d'étapes)
  - Crée les jobs dans `job_queue` avec les bonnes étapes
  - Gère les `user_gate` (pause pipeline pour validation)

## Phase 5 — DB Schema
- Table `pipeline_steps` pour tracer chaque étape d'un pipeline
- Ajouter colonne `model` dans `episode_shots` et `shots` 
- Ajouter colonnes `step_type` et `pipeline_run_id`

## Hors scope initial
- UI des gates de validation (sera fait après)
- Intégration Act-Two avec driving performance video (nécessite upload vidéo)
