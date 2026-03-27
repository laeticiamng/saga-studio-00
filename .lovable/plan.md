

# Audit technique — Saga Studio (27 mars 2026, v3)

## Résumé

Après les corrections v2 (breadcrumbs, ConfirmDialog, NetworkStatus, typage SeasonPanel/EpisodeCard), voici les lacunes résiduelles.

---

## IMPORTANT (fonctionnel / type-safety)

### 1. `as any` résiduels dans les `.map()` de 5 fichiers
Les données venant de Supabase sont typées automatiquement, mais les `.map()` les castent encore en `any` :
- `EpisodeView.tsx` : `(run: any)` l.136, `(r: any)` l.172/196/222, `(a: any)` l.180, `(f: any)` l.204, `(issue: any)` l.230
- `AgentDashboard.tsx` : `(run: any)` l.109
- `DocumentsCenter.tsx` : `(entity: any)` l.275, `(m: any)` l.316, `entitiesByType: Record<string, any[]>` l.212
- `Settings.tsx` : `(wh: any)` l.228
- `EpisodePipeline.tsx` : `(s: any)` l.66

**Correction** : supprimer les casts `any` — les types Supabase sont suffisants (ou utiliser des types intermédiaires).

### 2. `as any` structurels dans 3 fichiers
- `ProjectView.tsx` l.218-220 : `plan?.shotlist_json as any[]`, `plan?.style_bible_json as Record<string, any>`, `audioAnalysis?.sections_json as any[]` — les types JSON de Supabase renvoient `Json`, qui doit être casté vers des interfaces.
- `useFeatureFlag.ts` l.15/20 : `.from("feature_flags" as any)` — `feature_flags` est dans le schéma, le cast est inutile.
- `ShotGrid.tsx` l.37 : `"regenerating" as any` — le status enum ne contient peut-être pas cette valeur.

**Correction** : définir des interfaces pour les payloads JSON, supprimer les casts inutiles.

### 3. Settings sans breadcrumbs
La page Settings n'utilise pas le composant `<Breadcrumbs>`.
**Correction** : ajouter `<Breadcrumbs items={[{ label: "Paramètres" }]} />`.

### 4. Pas de lien vers Settings depuis la Navbar
L'utilisateur doit deviner l'URL `/settings`. Il n'y a aucun lien dans le menu/profil.
**Correction** : vérifier la Navbar et ajouter un lien vers les paramètres dans le menu utilisateur.

---

## AMÉLIORATIONS (UX / dette technique)

### 5. Dashboard sans état vide pour les séries
Quand `seriesEnabled` est true mais qu'il n'y a aucune série, le CTA "Nouvelle série" existe mais l'état vide ne le mentionne pas.
**Correction** : ajouter un bouton "Créer une série" dans l'état vide quand le feature flag est actif.

### 6. Pas d'empty state informatif sur EpisodeView onglet "Agents"
L'onglet Agents affiche juste "Aucune exécution d'agent" sans expliquer comment en déclencher.
**Correction** : ajouter un message explicatif et un lien vers l'Autopilot.

### 7. Webhooks : pas de confirmation avant suppression
`Settings.tsx` l.132 supprime un webhook sans demander confirmation.
**Correction** : utiliser `<ConfirmDialog>` comme pour les séries/saisons/épisodes.

### 8. `ShareView` n'affiche pas les séries
`ShareView` ne gère que `clip` et `film` dans `typeLabels`. Si un utilisateur partage un projet de type `series`, le label sera brut.
**Correction** : ajouter `series: "Série"` au mapping.

### 9. Credits : pas de lien vers la page Pricing depuis Settings
Le solde de crédits est affiché mais aucun CTA ne permet d'acheter des crédits supplémentaires.
**Correction** : ajouter un bouton "Acheter des crédits" qui redirige vers `/pricing`.

### 10. Accessibilité : onglets EpisodeView sans labels complets
Les `TabsTrigger` utilisent des icônes mais pas de texte visible sur mobile (ils sont visibles, mais petits).
Pas bloquant mais améliore l'UX mobile.

### 11. Pas de gestion du cas "série supprimée" dans les pages studio
Si une série est supprimée alors que l'utilisateur est sur `/series/:id/autopilot`, la page affiche des données vides sans redirection ni message.
**Correction** : ajouter un redirect ou un message "Série non trouvée" dans les pages studio quand `series` est null après le chargement.

---

## Plan d'implémentation

| # | Action | Fichiers |
|---|--------|----------|
| 1 | Supprimer les casts `any` des `.map()` (EpisodeView, AgentDashboard, DocumentsCenter, Settings, EpisodePipeline) | 5 fichiers |
| 2 | Interfaces JSON pour ProjectView (shotlist, styleBible, sections) + fix useFeatureFlag/ShotGrid | 3 fichiers |
| 3 | Breadcrumbs dans Settings | `Settings.tsx` |
| 4 | Lien Settings dans la Navbar (si manquant) | `Navbar.tsx` |
| 5 | CTA série dans l'état vide du Dashboard | `Dashboard.tsx` |
| 6 | ConfirmDialog pour suppression webhook | `Settings.tsx` |
| 7 | `series: "Série"` dans ShareView | `ShareView.tsx` |
| 8 | Bouton "Acheter des crédits" dans Settings | `Settings.tsx` |
| 9 | Gestion "Série non trouvée" dans les pages studio | 6 fichiers |

Priorité recommandée : **#1-2** (type-safety), puis **#3-4** (navigation), puis **#5-9** (UX polish).
