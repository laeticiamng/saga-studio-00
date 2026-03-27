

# Audit technique — Saga Studio (27 mars 2026)

## Résumé

Après inspection approfondie du code (pages, hooks, edge functions, navigation), voici les lacunes restantes classées par sévérité.

---

## CRITIQUE (bloquant ou risque de crash)

### 1. `as any` résiduels dans Dashboard.tsx
`Dashboard.tsx` lignes 170-171 utilisent `(project as any)._seriesId`. La donnée `_seriesId` est ajoutée dynamiquement dans le `queryFn` mais n'est pas typée.
**Correction** : typer le retour du query avec une interface étendue.

### 2. EpisodeView breadcrumbs incomplets
Le fil d'Ariane de `EpisodeView.tsx` ne remonte pas jusqu'à la série ni la saison (seulement "Mes projets → Ép. X"). L'utilisateur n'a aucun moyen de remonter vers la série ou la saison.
**Correction** : récupérer `season` et `series` via la relation et les ajouter au breadcrumb.

### 3. Pas de breadcrumbs sur les pages studio (Autopilot, Approvals, Continuity, Delivery, Documents, Agents)
Ces 6 pages n'ont aucun fil d'Ariane, rendant la navigation difficile.
**Correction** : ajouter `<Breadcrumbs>` sur chacune.

---

## IMPORTANT (fonctionnel manquant)

### 4. Absence de suppression pour séries/saisons/épisodes
Aucun hook `useDeleteSeries`, `useDeleteSeason`, `useDeleteEpisode` n'existe. L'utilisateur ne peut pas supprimer ses créations.
**Correction** : créer les hooks de suppression et ajouter les boutons dans les UI correspondantes (SeriesView, SeasonPanel, EpisodeCard).

### 5. Pas d'estimation de coût avant lancement du pipeline série
`CreateClip` et `CreateFilm` appellent `estimate-cost`, mais le workflow série (50 min, ~600 plans) ne montre aucune estimation avant de lancer l'Autopilot.
**Correction** : ajouter un appel `estimate-cost` dans `EpisodePipeline` ou `AutopilotDashboard` avant le démarrage, affichant le coût en crédits.

### 6. Pas de pagination dans les logs d'audit
`AdminAuditLog` charge 100 lignes max sans pagination. Les admins perdent la visibilité au-delà de 100 entrées.
**Correction** : ajouter une pagination simple (boutons précédent/suivant).

### 7. `episode-pipeline` invoqué par `run-agent` sans header Authorization
Ligne 611-613 de `run-agent/index.ts` : `supabase.functions.invoke("episode-pipeline", { body: { episode_id } })` — l'appel passe par le client service role, mais `episode-pipeline` valide maintenant un JWT utilisateur (ajouté dans le dernier audit). Le chaînage automatique va échouer.
**Correction** : dans `episode-pipeline`, accepter aussi le service role key (vérifier si l'appel vient du service role), ou retirer la validation JWT de `episode-pipeline` puisqu'il est déjà appelé en interne.

---

## AMÉLIORATIONS (UX / dette technique)

### 8. Style preset manquant dans CreateSeries
`CreateFilm` et `CreateClip` permettent de choisir un style visuel (cinematic, anime, etc.), mais `CreateSeries` ne propose pas ce choix.
**Correction** : ajouter un sélecteur de style preset.

### 9. `ShareView` utilise `projects_public as any`
La vue `projects_public` n'existe probablement pas dans le schéma typé, causant un cast `as any`.
**Correction** : vérifier si la vue existe, sinon la créer ou utiliser un accès public via RLS.

### 10. Pas de Realtime dans AutopilotDashboard
Le dashboard Autopilot utilise React Query classique sans abonnement Realtime. L'utilisateur doit rafraîchir manuellement pour voir la progression.
**Correction** : ajouter un abonnement `supabase.channel()` sur `workflow_runs` et `workflow_steps` pour invalider les queries en temps réel.

### 11. Aucune gestion d'erreur de réseau globale
Pas de retry UI ni de message "connexion perdue" pour les utilisateurs en réseau instable.

---

## Plan d'implémentation

| # | Action | Fichiers |
|---|--------|----------|
| 1 | Fix `episode-pipeline` auth pour accepter service role (chaînage) | `supabase/functions/episode-pipeline/index.ts` |
| 2 | Typer `_seriesId` dans Dashboard | `src/pages/Dashboard.tsx` |
| 3 | Breadcrumbs complets sur EpisodeView + 6 pages studio | `EpisodeView.tsx`, `AutopilotDashboard.tsx`, `ApprovalInbox.tsx`, `ContinuityCenter.tsx`, `DeliveryCenter.tsx`, `DocumentsCenter.tsx`, `AgentDashboard.tsx` |
| 4 | Hooks + UI de suppression (série/saison/épisode) | `useSeries.ts`, `useSeasons.ts`, `useEpisodes.ts`, `SeriesView.tsx`, `SeasonPanel.tsx`, `EpisodeCard.tsx` |
| 5 | Estimation de coût avant Autopilot | `AutopilotDashboard.tsx` |
| 6 | Pagination audit logs | `AdminAuditLog.tsx` |
| 7 | Style preset dans CreateSeries | `CreateSeries.tsx` |
| 8 | Realtime dans AutopilotDashboard | `AutopilotDashboard.tsx` |

Priorité recommandée : **#1 d'abord** (bloque le chaînage automatique du pipeline), puis #2-3 (navigation), puis #4-8.

