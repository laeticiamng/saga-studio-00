
# CineClip AI - Plan de construction complet

## Vue d'ensemble

Transformer la landing page actuelle en une plateforme full-stack de generation de clips video et courts metrages, avec authentification, pipeline de generation IA multi-providers, systeme de credits/billing Stripe, et dashboard admin.

---

## Phase 1 : Infrastructure Backend (Supabase)

### 1.1 Activer Lovable Cloud / Supabase
- Connecter le projet a Supabase (Cloud)
- Configurer l'authentification (email + OAuth Google/GitHub)

### 1.2 Schema de base de donnees (migrations SQL)

**Tables a creer :**

| Table | Description |
|-------|-------------|
| `profiles` | Infos utilisateur (display_name, avatar_url) |
| `user_roles` | Roles (admin, moderator, user) avec enum `app_role` |
| `credit_wallets` | Solde de credits par utilisateur |
| `credit_ledger` | Historique des transactions credits |
| `projects` | Projets (clip ou film) avec metadonnees |
| `audio_analysis` | Resultat analyse audio (BPM, sections, beats) |
| `plans` | Style bible, character bible, shotlist JSON |
| `shots` | Shots individuels generes par l'IA |
| `renders` | Fichiers finaux (16:9, 9:16, teaser) |
| `moderation_flags` | Signalements pour moderation |
| `provider_configs` | Configuration providers par defaut (admin) |

**Securite :**
- RLS sur toutes les tables utilisateur
- Fonction `has_role()` security definer pour eviter la recursion
- Storage buckets : `audio-uploads`, `face-references`, `shot-outputs`, `renders` avec policies par user

### 1.3 Edge Functions

| Fonction | Role |
|----------|------|
| `create-project` | Creer un projet clip ou film |
| `analyze-audio` | Analyser l'audio (BPM, beats, sections) via Lovable AI |
| `plan-project` | Generer style_bible + character_bible + shotlist via Lovable AI |
| `generate-shots` | Appeler le provider video (Sora 2 / Runway / Luma / Veo) |
| `check-shot-status` | Polling du statut des shots en cours |
| `stitch-render` | Lancer l'assemblage final (FFmpeg via endpoint externe) |
| `project-status` | Statut global du pipeline |
| `estimate-cost` | Calculer le cout en credits avant generation |
| `admin-actions` | Moderation, refunds, stats (protege par role admin) |

---

## Phase 2 : Provider Abstraction Layer

### Interface TypeScript commune

```text
Provider Interface:
  - generateVideo(prompt, duration, style, seed) -> job_id
  - checkStatus(job_id) -> status + output_url
  - getCapabilities() -> max_duration, formats, features
```

### Providers implementes

| Provider | Duree max | Notes |
|----------|-----------|-------|
| OpenAI Sora 2 | Variable | Provider par defaut, audio sync |
| Runway Gen-4 | 5-10s | Shots courts |
| Luma Dream Machine | Variable | Support references image |
| Google Veo 3.1 | 8s | Alternative |

Chaque provider est active/desactive via variables d'environnement (secrets Supabase). Si la cle manque, le provider est masque dans l'UI.

---

## Phase 3 : Frontend - Pages et composants

### 3.1 Navigation et layout
- Navbar sticky avec logo CineClip AI, liens, bouton connexion/credits
- Layout principal avec sidebar pour projets
- Footer mis a jour

### 3.2 Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page (existante, mise a jour) |
| `/auth` | Login / Signup |
| `/dashboard` | Liste des projets, stats rapides |
| `/create/clip` | Formulaire creation clip (upload audio, mode, style, duree) |
| `/create/film` | Formulaire creation film (titre, synopsis, style, duree) |
| `/project/:id` | Vue projet : pipeline live, timeline, preview |
| `/project/:id/result` | Page resultat : download, exports, logs |
| `/pricing` | Plans Stripe + credit packs |
| `/admin` | Dashboard admin (protege par role) |
| `/settings` | Parametres compte, provider prefere |

### 3.3 Composants cles

- **ProjectCreationWizard** : Multi-step form (audio upload -> mode -> style -> estimation -> confirmation)
- **PipelineProgress** : Timeline visuelle en temps reel (Analyze -> Plan -> Generate -> QA -> Stitch -> Export)
- **ShotGrid** : Grille de tous les shots generes avec statut
- **VideoPlayer** : Lecteur video integre pour preview
- **CreditDisplay** : Badge credits dans la navbar
- **CostEstimator** : Estimation dynamique du cout avant generation
- **StylePresetPicker** : Selecteur visuel de styles (Cinematic, Anime, Noir, Hyperpop, Afrofuturism, etc.)
- **AdminProjectTable** : Table de moderation avec filtres

---

## Phase 4 : Pipeline de generation

### Flux complet (Clip)

```text
1. Upload audio -> Supabase Storage
2. analyze-audio -> Extract BPM, beats, sections, energy
3. plan-project -> Director Agent via Lovable AI
   -> style_bible + character_bible + shotlist (20-60 shots)
4. generate-shots -> Pour chaque shot :
   - Appel provider API
   - Polling statut
   - QA basique (echec -> regen, deviation style -> regen contrainte)
   - Stockage output dans Storage
5. stitch-render -> FFmpeg :
   - Aligner cuts sur beat grid
   - Transitions entre shots
   - Export 16:9 master + 9:16 crop + teaser 15s
6. Notification utilisateur -> Projet pret
```

### Job Queue (sans service externe)
- Table `job_queue` dans Supabase
- Edge function worker pollee via pg_cron (toutes les 30s)
- Chaque etape du pipeline est un job avec statut et retry logic

---

## Phase 5 : Billing (Stripe)

- Activer l'integration Stripe Lovable
- Plans d'abonnement : Free (10 credits/mois), Pro (100 credits), Studio (500 credits)
- Credit packs additionnels : 50 credits, 200 credits, 500 credits
- Formule de cout : `credits = base_cost + (nb_shots x shot_cost x resolution_multiplier)`
- Verification du solde avant chaque generation
- Webhook Stripe pour mise a jour automatique du wallet

---

## Phase 6 : Admin Dashboard

- Vue liste de tous les projets avec filtres (statut, user, date, flags)
- Detail projet : prompts, outputs, shots, logs
- Actions : desactiver utilisateur, rembourser credits, supprimer contenu
- Stats : usage par provider, credits consommes, projets par jour

---

## Ordre d'implementation

1. Activer Supabase / Lovable Cloud
2. Migrations SQL (schema complet + RLS + fonctions)
3. Auth (login/signup) + profil utilisateur
4. Dashboard utilisateur (liste projets vide)
5. Formulaire creation clip + creation film
6. Edge functions pipeline (create -> analyze -> plan -> generate -> stitch)
7. Provider abstraction + secrets API
8. Pipeline progress UI en temps reel
9. Page resultat avec exports
10. Activer Stripe + pricing page + credit system
11. Admin dashboard
12. Polish : animations, responsive, error handling

---

## Details techniques

- **Stack** : React + Vite + TypeScript + Tailwind (pas de Next.js)
- **Backend** : Supabase Edge Functions (Deno) pour toute la logique serveur
- **Storage** : Supabase Storage pour audio, references, shots, renders
- **Auth** : Supabase Auth avec profils + roles
- **State** : TanStack Query pour le data fetching + polling pipeline
- **Routing** : React Router v6 avec routes protegees
- **FFmpeg** : L'assemblage final necessitera soit un endpoint FFmpeg externe, soit un service tiers (limitation Edge Functions pour le traitement video lourd) - on preparera l'architecture et on pourra integrer un service comme Shotstack ou un serveur FFmpeg dedie plus tard
- **Providers video** : Les cles API seront stockees en secrets Supabase, les appels se font uniquement depuis les Edge Functions

