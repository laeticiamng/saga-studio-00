


# Audit technique — Saga Studio (27 mars 2026, v4)

## Résumé

Après les corrections v3 (suppression de 22 `as any`, breadcrumbs Settings, ConfirmDialog webhooks, CTA crédits, ShareView series, Dashboard empty state), voici les lacunes résiduelles.

---

## IMPORTANT (fonctionnel / robustesse)

### 1. Pages création sans Breadcrumbs
`CreateClip.tsx`, `CreateFilm.tsx` et `CreateSeries.tsx` n'utilisent pas le composant `<Breadcrumbs>`.
**Correction** : ajouter `<Breadcrumbs items={[{ label: "Nouveau clip/film/série" }]} />`.

### 2. Pas de gestion "série supprimée" dans les pages studio
Si une série est supprimée alors que l'utilisateur est sur `/series/:id/autopilot`, `/series/:id/agents`, etc., la page affiche des données vides sans redirection ni message.
**Pages concernées** : `AutopilotDashboard`, `ApprovalInbox`, `ContinuityCenter`, `DeliveryCenter`, `DocumentsCenter`, `AgentDashboard`, `BibleManager`, `CharacterGallery`.
**Correction** : dans chaque page, après le chargement, si `series` est null, afficher un message "Série non trouvée" avec un lien retour Dashboard.

### 3. Onglet "Agents" dans EpisodeView sans guidance
L'onglet affiche "Aucune exécution d'agent pour cet épisode." sans expliquer comment en déclencher.
**Correction** : ajouter un lien vers l'Autopilot de la série parente.

### 4. `as any` résiduels côté edge functions
5 fichiers edge functions utilisent encore `as any` :
- `stitch-render/index.ts` : `as any[]` pour beats/sections/energy JSON
- `export-assets/index.ts` : `(e.season as any)?.series_id`
- `generate-shots/index.ts` : `status as any`, `as Record<string, any>`, `as any[]`
- `plan-project/index.ts` : `sections as any[]`
- `stripe-webhook/index.ts` : `(customer as any).deleted`

**Note** : les edge functions n'ont pas les types générés Supabase. Ces casts sont nécessaires ou tolérés. **Pas d'action requise** sauf si on copie les types dans les edge functions.

---

## AMÉLIORATIONS (UX / dette technique)

### 5. Console.log/warn/error dans le code client
9 fichiers client contiennent des `console.*` directs (hors `logger.ts`) :
- `CreateClip.tsx`, `CreateFilm.tsx`, `RenderExportPanel.tsx`, `ProjectView.tsx`, `NotFound.tsx`, `ffmpeg-renderer.ts`, `main.tsx`, `ErrorBoundary.tsx`
**Correction** : remplacer par le `logger` centralisé pour une meilleure observabilité.

### 6. Duplication des constantes label/style
`statusLabels`, `typeLabels`, `styleLabels` sont dupliqués dans `Dashboard.tsx`, `ProjectView.tsx`, `ShareView.tsx`, `Admin.tsx`.
**Correction** : extraire dans `src/lib/labels.ts` pour centralisation.

### 7. Pas de favicon réel
`index.html` référence `/favicon.ico` mais le fichier n'existe pas dans `/public`. Seul `placeholder.svg` est présent.
**Correction** : générer un favicon ou le remplacer par le SVG existant.

### 8. OG image manquante
`index.html` référence `/og-image.jpg` qui n'existe pas dans le dossier public.
**Correction** : générer une image OG 1200x630 ou supprimer la meta.

### 9. Pages protégées sans meta description dynamique
Les pages du studio (`ProjectView`, `EpisodeView`, etc.) n'ont pas de meta description SEO. Elles héritent de la meta de la landing page.
**Pas bloquant** pour les pages protégées (non indexées).

### 10. Pas de page 404 stylisée pour les routes `/series/:id/*` inexistantes
Si un utilisateur tape une route studio invalide (ex: `/series/abc/foo`), c'est le `NotFound` générique qui s'affiche.
**Peu prioritaire** car protégé par l'auth.

---

## Plan d'implémentation

| # | Action | Fichiers | Priorité |
|---|--------|----------|----------|
| 1 | Breadcrumbs dans CreateClip, CreateFilm, CreateSeries | 3 fichiers | Moyenne |
| 2 | Gestion "série non trouvée" dans 8 pages studio | 8 fichiers | Haute |
| 3 | Guidance onglet Agents vide dans EpisodeView | 1 fichier | Moyenne |
| 4 | Centraliser les labels dupliqués | 5+ fichiers | Basse |
| 5 | Remplacer console.* par logger | 6 fichiers | Basse |
| 6 | Favicon + OG image | 2 assets | Basse |

Priorité recommandée : **#2** (robustesse), puis **#1 + #3** (navigation/UX), puis **#4-6** (dette technique).
