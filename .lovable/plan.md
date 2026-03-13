

## Plan : Autonomiser le fonctionnement interne de la plateforme

L'objectif est d'intégrer les méthodologies du document de formation (5 piliers du prompt, structure en 4 actes, storyboard, bibles de style/personnage, prompt cinématographique) directement dans le pipeline automatisé, pour que l'utilisateur n'ait qu'à fournir une idée simple et que la plateforme fasse le reste.

---

### 1. Corriger l'erreur de build (check-subscription)

Remplacer `import { createClient } from "npm:@supabase/supabase-js@2.57.2"` par `import { createClient } from "https://esm.sh/@supabase/supabase-js@2"` dans `supabase/functions/check-subscription/index.ts` et `supabase/functions/customer-portal/index.ts`.

---

### 2. Ajouter la génération AI du synopsis (CreateFilm)

Dans `src/pages/CreateFilm.tsx`, ajouter un bouton "Enrichir avec l'IA" qui prend l'idée brute de l'utilisateur (quelques mots) et appelle une nouvelle edge function `enhance-synopsis` pour :
- Appliquer la méthode **High Concept** (pitch en 1 phrase)
- Générer un synopsis structuré en **4 actes** (Hook 0-5s, Contexte 5-20s, Développement 20-50s, Climax 50-60s)
- Créer automatiquement les fiches personnage (Want/Need/Flaw) et antagoniste
- Proposer l'ambiance visuelle (palette, lumière, mood)

L'utilisateur voit le synopsis généré pré-rempli dans le textarea et peut l'ajuster avant de lancer.

---

### 3. Enrichir le plan-project avec les 5 piliers du prompt

Modifier `supabase/functions/plan-project/index.ts` pour intégrer la **formule cinématographique** du document dans le prompt AI :

```
[Sujet Détaillé] + [Style Artistique] + [Cadrage & Composition] + [Lumière & Ambiance] + [Détails & Textures]
```

- Chaque shot du shotlist inclura des instructions explicites de cadrage (plan large, moyen, gros plan, contre-plongée)
- La style_bible sera enrichie avec : palette de couleurs, règles de caméra, lighting style, texture guidelines
- La character_bible inclura les 3 piliers (Want/Need/Flaw) pour la cohérence narrative
- Les prompts négatifs seront systématiquement ajoutés

---

### 4. Améliorer le moteur de prompts de generate-shots

Modifier `supabase/functions/generate-shots/index.ts` pour que `buildStyleConsistentPrompt` applique automatiquement :

- **Mouvements de caméra** adaptés au type de plan (dolly in pour ouverture, tracking shot pour action, close-up statique pour émotion)
- **Formule complète** : `[Style & Ambiance] + [Sujet & Action] + [Décor & Contexte] + [Caméra & Cadrage] + [Lumière & Palette] + [Détails Techniques]`
- **Synchronisation énergie/musique** : sections haute énergie = plans dynamiques/rapides, sections calmes = plans larges/contemplatifs
- **Cohérence personnage** renforcée avec descriptions détaillées réutilisées à chaque shot

---

### 5. Nouvelle edge function : enhance-synopsis

Créer `supabase/functions/enhance-synopsis/index.ts` :
- Reçoit `{ idea, type, duration_sec, style_preset }`
- Utilise Lovable AI (gemini-2.5-flash) pour transformer l'idée en :
  - **Logline** (1 phrase)
  - **Synopsis complet** structuré en actes
  - **Personnages** avec descriptions visuelles détaillées
  - **Ambiance suggérée** (palette, lumière, références ciné)
- Retourne le tout pour pré-remplir le formulaire

---

### 6. Auto-enrichissement dans CreateClip

Dans `src/pages/CreateClip.tsx`, ajouter un champ optionnel "Décrivez l'ambiance souhaitée" qui, si rempli, sera passé au pipeline pour enrichir automatiquement les prompts de chaque shot avec le contexte narratif de l'utilisateur.

---

### Fichiers modifiés

| Fichier | Action |
|---|---|
| `supabase/functions/check-subscription/index.ts` | Fix import |
| `supabase/functions/customer-portal/index.ts` | Fix import |
| `supabase/functions/enhance-synopsis/index.ts` | Nouveau |
| `supabase/functions/plan-project/index.ts` | Enrichir prompt avec 5 piliers |
| `supabase/functions/generate-shots/index.ts` | Améliorer buildStyleConsistentPrompt |
| `src/pages/CreateFilm.tsx` | Bouton "Enrichir avec l'IA" |
| `src/pages/CreateClip.tsx` | Champ ambiance optionnel |
| `supabase/config.toml` | Ajouter enhance-synopsis |

