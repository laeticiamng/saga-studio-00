

# Analyse complète & Plan d'implémentation — Saga Studio

## Etat actuel (ce qui fonctionne)

La plateforme est très complète : auth (email + Google OAuth), wizard de creation 5 etapes, pipeline worker complet, multi-provider matrix, validation IA, review gates cascade, timeline studio, finishing panel persistant, export versionne, diagnostics, governance dashboard, Stripe checkout + credits, dashboard avec search/filter/sort/pagination/stats, project CRUD (edit/delete/duplicate), final video player, share view, settings (profile, avatar, password, webhooks, usage stats, credit history), SEO/OG tags, cookie banner, command palette, theme toggle, network status, onboarding tour, contact form, pages legales.

---

## Ce qu'il manque

### 1. Branding incohérent
Le Navbar dit "Saga Studio", le Footer/Auth/ShareView disent "CineClip AI". Il faut unifier sur "Saga Studio" partout.

**Fichiers** : `Footer.tsx`, `Auth.tsx`, `ShareView.tsx`, `CreditDisplay.tsx`, `RenderExportPanel.tsx`, `Settings.tsx`, `ThemeToggle.tsx` (localStorage key)

### 2. InsufficientCreditsAlert importée mais jamais rendue
`ProjectView.tsx` importe `InsufficientCreditsAlert` et set `creditsError` state, mais ne rend jamais le composant dans le JSX. L'alerte n'apparait donc jamais.

**Fichier** : `ProjectView.tsx` — ajouter `{creditsError && <InsufficientCreditsAlert />}` dans le JSX.

### 3. Suppression de compte manquante
Aucune option pour supprimer son compte dans Settings. C'est une obligation RGPD pour une plateforme SaaS francaise.

**Fichier** : `Settings.tsx` — ajouter un bouton "Supprimer mon compte" avec confirmation, qui appelle `supabase.functions.invoke("admin-actions", { body: { action: "delete_account" } })` ou directement `supabase.auth.admin.deleteUser()` via une edge function dediee.

**Edge function** : Creer `delete-account/index.ts` — supprime les projets, shots, renders, ledger, wallet, profile, puis l'user auth.

### 4. Email de bienvenue / notifications email
Aucun email transactionnel (bienvenue, render termine, credits faibles). Le secret `RESEND_API_KEY` est configure mais aucune edge function ne l'utilise sauf `send-contact`.

**Fichiers** : Creer `send-email/index.ts` — helper generique. Integrer dans `stripe-webhook` (confirmation achat), `pipeline-worker` (render termine).

### 5. Favicon manquant
`index.html` reference `/favicon.png` mais ce fichier n'existe pas dans `public/`.

**Fichier** : Generer un favicon SVG/PNG et le placer dans `public/favicon.png`.

### 6. OG Image manquante
`index.html` reference `/og-image.jpg` mais ce fichier n'existe probablement pas.

**Fichier** : Creer `public/og-image.jpg`.

### 7. Empty states ameliorables
Les pages comme `SeriesView`, `SeasonView`, `EpisodeView` manquent probablement de gestion d'erreur / empty states coherents (a verifier mais probable vu le pattern).

### 8. Confirmation avant quitter le wizard
`CreateProject.tsx` n'a pas de `beforeunload` guard. Si l'utilisateur ferme l'onglet au step 4, tout est perdu.

**Fichier** : `CreateProject.tsx` — ajouter `useEffect` avec `window.addEventListener("beforeunload", ...)`.

### 9. Rate limiting / protection anti-abus cote client
Aucun debounce sur les boutons critiques (lancer pipeline, dupliquer, enrichir synopsis). Un double-clic peut declencher deux appels.

**Fichiers** : `ProjectView.tsx` — les guards `if (duplicating) return` existent mais le bouton n'est pas toujours disable pendant le loading intermediaire.

### 10. Accessibilite (a11y)
- Pas de `aria-label` sur certains boutons icon-only
- Pas de skip-to-content link
- Les modales manquent parfois de focus trap (geree par Radix mais a verifier)

---

## Plan d'implementation (par priorite)

### Etape 1 — Branding unifie "Saga Studio"
Remplacer toutes les references "CineClip AI" par "Saga Studio" dans :
- `Footer.tsx` (nom + copyright)
- `Auth.tsx` (description)
- `ShareView.tsx` (3 occurrences)
- `CreditDisplay.tsx` (tooltip)
- `RenderExportPanel.tsx` (nom fichier export)
- `Settings.tsx` (texte webhook)
- `ThemeToggle.tsx` (localStorage key : `saga-studio-theme`)

### Etape 2 — Bug fix InsufficientCreditsAlert
Dans `ProjectView.tsx`, ajouter le rendu conditionnel du composant `InsufficientCreditsAlert` quand `creditsError === true`, juste au-dessus du pipeline progress.

### Etape 3 — Suppression de compte (RGPD)
- Creer `supabase/functions/delete-account/index.ts` qui supprime toutes les donnees utilisateur puis le compte auth
- Ajouter dans `Settings.tsx` une section "Zone de danger" avec bouton de suppression + dialog de confirmation avec saisie d'email pour valider

### Etape 4 — Favicon + OG image
- Generer un `public/favicon.png` (icone Film gradient)
- Generer un `public/og-image.jpg` (banniere 1200x630 avec le branding Saga Studio)

### Etape 5 — Guard de navigation wizard
Dans `CreateProject.tsx`, ajouter un `beforeunload` listener quand `step > 0` pour prevenir la perte de donnees.

### Etape 6 — Emails transactionnels
- Creer `supabase/functions/send-email/index.ts` utilisant Resend
- Integrer dans le flow post-inscription (email de bienvenue) et post-render (notification de completion)

### Etape 7 — Corrections a11y mineures
- Ajouter `aria-label` aux boutons icon-only dans Navbar, ProjectView, Settings
- Ajouter un skip-to-content link dans le layout

---

## Estimation
- Etapes 1-2 : corrections rapides (~10 min)
- Etape 3 : edge function + UI (~20 min)
- Etape 4 : assets statiques (~5 min)
- Etape 5 : guard simple (~5 min)  
- Etape 6 : edge function email (~15 min)
- Etape 7 : a11y polish (~10 min)

