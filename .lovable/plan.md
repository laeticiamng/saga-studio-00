

# Audit technique — Saga Studio (27 mars 2026, v5)

## Résumé

Après les corrections v4 (SeriesNotFound guards, Breadcrumbs création, labels.ts, favicon/OG, logger), voici les lacunes résiduelles.

✅ **Acquis v4** :
- 0 `as any` côté client
- TypeScript compile sans erreur
- Breadcrumbs sur toutes les pages (création, studio, settings)
- SeriesNotFound guard sur 8 pages studio
- Favicon + OG image générés
- Guidance onglet Agents vide (EpisodeView)

---

## IMPORTANT (dette technique active)

### 1. Labels dupliqués non consommés depuis `labels.ts`
Le fichier `src/lib/labels.ts` a été créé mais **4 fichiers continuent d'utiliser leurs propres copies locales** :
- `Dashboard.tsx` (lignes 16-49)
- `Admin.tsx` (lignes 27-41)
- `ProjectView.tsx` (lignes 24-40)
- `ShareView.tsx` (lignes 11-17)

**Note** : `BibleEditor.tsx` a ses propres `typeLabels` pour les types de bibles (style/character/world/tone/custom) — c'est un domaine différent, pas de duplication.

**Correction** : Remplacer les constantes locales par `import { statusLabels, typeLabels, styleLabels } from "@/lib/labels"` dans ces 4 fichiers.

### 2. `console.*` résiduels côté client
5 fichiers utilisent encore `console.*` directement :
- `NotFound.tsx` : `console.error` pour le 404 → remplacer par `logger.warn`
- `main.tsx` : `console.error` pour les erreurs fatales → **garder** (logger non disponible si l'import échoue)
- `ErrorBoundary.tsx` : `console.error` dans `componentDidCatch` → **garder** (fallback critique)
- `ffmpeg-renderer.ts` : `console.log/warn/error` pour le rendu FFmpeg → remplacer par `logger`

**Correction** : remplacer dans `NotFound.tsx` et `ffmpeg-renderer.ts`. Garder `main.tsx` et `ErrorBoundary.tsx` car ce sont des fallbacks critiques.

---

## AMÉLIORATIONS (basse priorité)

### 3. `ProjectView.tsx` — `statusVariants` non centralisé
Le mapping `statusVariants` (associant statuts à des variantes de Badge) est défini localement. Pourrait être ajouté à `labels.ts`.

### 4. Pas de page 404 contextualisée pour `/series/:id/*`
Si un utilisateur tape `/series/abc/foo`, il voit le NotFound générique.
**Peu prioritaire** car protégé par l'auth.

### 5. `AdminAuditLog.tsx` — pas de Breadcrumbs
Les autres pages admin (`AdminAgentManager`, `AdminProviderDashboard`) n'ont pas non plus de Breadcrumbs, mais c'est cohérent entre elles. À ajouter si on veut une navigation admin complète.

---

## Plan d'implémentation

| # | Action | Fichiers | Priorité |
|---|--------|----------|----------|
| 1 | Consommer `labels.ts` dans 4 fichiers | Dashboard, Admin, ProjectView, ShareView | Moyenne |
| 2 | Remplacer `console.*` par logger | NotFound, ffmpeg-renderer | Basse |
| 3 | Centraliser `statusVariants` | labels.ts + ProjectView | Basse |

**Estimation** : ~15 min, 0 risque de régression.
