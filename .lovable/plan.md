
# Plan : Wizard de création intelligent avec ingestion de corpus

## Architecture

Le wizard passe de 6 à 7 étapes avec un **dual-path** dès l'étape 1 :

### Nouveau flow

1. **Type + Mode** — Choix du type de projet (série/film/clip/hybrid) + choix du parcours (scratch vs corpus)
2. **Import Corpus** *(corpus path only)* — Upload multi-fichiers (docs, images, audio, vidéo) avec progression
3. **Brief intelligent** — Si corpus : affiche les valeurs extraites (titre, synopsis, metadata) éditables avec provenance. Si scratch : formulaire classique avec "Enrichir IA"
4. **Paramètres techniques** — Durée, format, uploads médias spécifiques (audio pour clip, vidéo pour hybrid)
5. **Style & Qualité** — Inchangé
6. **Identité** — Photos de référence (pré-remplies si corpus contient des images)
7. **Confirmer** — Résumé + coût estimé + résumé des données extraites

## Composants à créer

### Frontend
- `src/components/create/CreationModeSelector.tsx` — Dual-path selector (scratch vs corpus)
- `src/components/create/CorpusUploader.tsx` — Zone d'upload multi-fichiers avec progression et classification
- `src/components/create/ExtractionSummary.tsx` — Panel résumé des données extraites (titre, synopsis, personnages, structure)
- `src/components/create/ExtractedField.tsx` — Champ pré-rempli avec badge de confiance, source, et actions (accepter/éditer/ignorer)
- `src/components/create/MissingInfoAlert.tsx` — Alerte intelligente pour les données manquantes

### Backend (Edge Function)
- Ajout d'une action `wizard_extract` dans `import-document` qui :
  - Accepte un `project_type` sans `project_id` (extraction pré-projet)
  - Retourne directement les champs extractibles pour le wizard
  - Adapte l'extraction au type de projet sélectionné

### Logique
- Les fichiers sont uploadés dans `source-documents` bucket immédiatement
- L'extraction IA tourne en parallèle pendant que l'user continue
- Les résultats sont affichés progressivement
- À la création finale, les documents sont rattachés au projet/série créé

## Ce qui ne change PAS
- Les étapes Style & Qualité
- La logique de création finale (handleCreate)
- L'edge function import-document existante (on ajoute une action, pas de breaking change)
- Les tables DB existantes (aucune migration nécessaire)

## Ordre d'implémentation
1. Créer les composants UI (5 fichiers)
2. Ajouter l'action `wizard_extract` à l'edge function
3. Refactorer `CreateProject.tsx` pour intégrer le dual-path
4. Déployer l'edge function
5. Vérifier le build
