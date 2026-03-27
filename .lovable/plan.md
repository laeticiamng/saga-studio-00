

# Audit technique — Saga Studio (27 mars 2026, v2)

## Résumé

Après le premier round de corrections, voici les lacunes restantes identifiées par inspection approfondie de tout le code.

---

## CRITIQUE (bloquant ou risque de crash)

### 1. `as any` massifs dans les pages studio (breadcrumbs & données)
6 pages utilisent `(series?.project as any)?.title` dans les breadcrumbs :
- `AutopilotDashboard.tsx` (l.160)
- `ApprovalInbox.tsx` (l.72)
- `ContinuityCenter.tsx` (l.51)
- `DeliveryCenter.tsx` (l.76)
- `DocumentsCenter.tsx` (l.108)
- `AgentDashboard.tsx` (l.36)

`EpisodeView.tsx` (l.59-61) utilise `(episode.season as any).series?.title` et `(episode.season as any).series_id` — mais le query `useEpisode` ne joint PAS la série, il ne récupère que `season(id, number, title, series_id)`. Le breadcrumb affiche donc "Série" au lieu du vrai titre.

**Correction** : créer un helper typé `getSeriesTitle(series)` et enrichir `useEpisode` pour joindre `series` via `season`.

### 2. Breadcrumbs absents sur BibleManager et CharacterGallery
Ces 2 pages n'ont aucun fil d'Ariane, rendant la navigation impossible depuis ces pages.
**Correction** : ajouter `<Breadcrumbs>` avec le chemin "Mes projets → [Série] → Bibles/Personnages".

### 3. SeasonView breadcrumbs illisibles
Ligne 76 de `SeasonView.tsx` utilise un casting chaîné monstrueux :
```ts
String((series as Record<string, unknown>)?.project ? ((series as Record<string, unknown>).project as Record<string, unknown>)?.title || "Série" : "Série")
```
**Correction** : utiliser le même helper typé.

---

## IMPORTANT (fonctionnel manquant)

### 4. `useEpisode` ne joint pas la série — breadcrumbs cassés
Le hook `useEpisode` (l.32) fait `.select("*, season:seasons!episodes_season_id_fkey(id, number, title, series_id)")` mais ne joint pas `series` depuis `season`. Le breadcrumb de EpisodeView ne peut donc pas afficher le titre de la série.
**Correction** : modifier la query pour inclure `series:series!seasons_series_id_fkey(id, project_id, project:projects!series_project_id_fkey(title))` via la saison.

### 5. `confirm()` natif au lieu de Dialog de confirmation
`SeriesView`, `SeasonPanel`, `EpisodeCard` utilisent `window.confirm()` — UI native moche et non-thématisée.
**Correction** : créer un composant `<ConfirmDialog>` réutilisable basé sur AlertDialog.

### 6. ProjectView n'utilise pas `<Breadcrumbs>`
`ProjectView.tsx` utilise un bouton "Retour" custom au lieu du composant Breadcrumbs partagé. Incohérent avec le reste du studio.
**Correction** : remplacer par `<Breadcrumbs>`.

### 7. Pas de gestion d'erreur réseau globale
Aucun indicateur "connexion perdue" ni retry automatique en cas de réseau instable. L'app échoue silencieusement.
**Correction** : ajouter un composant `<NetworkStatus>` qui détecte `navigator.onLine` et affiche un bandeau.

---

## AMÉLIORATIONS (UX / dette technique)

### 8. Types `any` excessifs dans les composants
- `EpisodeCard.tsx` : `episode: any` (l.38)
- `SeasonPanel.tsx` : `season: any` (l.15)
- `DocumentsCenter.tsx` : `entitiesByType: Record<string, any[]>` (l.211)
- `EpisodeView.tsx` : `agentRuns.map((run: any)` (l.132), `psychReviews.map((r: any)` (l.168)
- `AutopilotDashboard.tsx` : `episodes.map((ep: any)` (l.188), `steps?.find((s: any)` (l.252)
**Correction** : typer ces données avec les types générés de Supabase.

### 9. Pas de loading state sur les boutons de suppression
Les boutons de suppression dans `SeriesView`, `SeasonPanel`, `EpisodeCard` ne montrent pas de spinner pendant la suppression.
**Correction** : ajouter `disabled={isPending}` et spinner.

### 10. Settings page sans breadcrumbs
La page Settings n'a aucun fil d'Ariane.

### 11. Aucun SEO (meta descriptions) sur les pages protégées
Les pages Dashboard, ProjectView, SeriesView, etc. n'ont aucune meta description. Seul `usePageTitle` est utilisé.

---

## Plan d'implémentation

| # | Action | Fichiers |
|---|--------|----------|
| 1 | Helper typé `getSeriesProjectTitle` + fix `useSeries` types | Nouveau helper, `useSeries.ts` |
| 2 | Enrichir `useEpisode` pour joindre série+projet | `useEpisodes.ts` |
| 3 | Fix breadcrumbs sur 8 pages (AutopilotDashboard, ApprovalInbox, ContinuityCenter, DeliveryCenter, DocumentsCenter, AgentDashboard, BibleManager, CharacterGallery) + SeasonView + EpisodeView | 10 fichiers |
| 4 | Composant `<ConfirmDialog>` + remplacement de `confirm()` | Nouveau composant, `SeriesView.tsx`, `SeasonPanel.tsx`, `EpisodeCard.tsx` |
| 5 | Breadcrumbs dans ProjectView | `ProjectView.tsx` |
| 6 | Composant `<NetworkStatus>` | Nouveau composant, `App.tsx` |
| 7 | Typage strict des composants (EpisodeCard, SeasonPanel, etc.) | ~6 fichiers |
| 8 | Loading state sur boutons de suppression | `SeriesView.tsx`, `SeasonPanel.tsx`, `EpisodeCard.tsx` |

Priorité recommandée : **#1-3 d'abord** (type-safety + navigation), puis **#4** (UX), puis **#5-8**.
