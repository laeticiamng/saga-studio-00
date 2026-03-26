# Autofill — Pré-remplissage intelligent

## Concept

L'autofill extrait les informations d'un document source importé et pré-remplit automatiquement les champs du projet (série, épisodes, personnages, bibles, scènes).

## Pipeline

1. **Upload** → stockage dans `source-documents` bucket
2. **Extraction texte** → découpage en chunks (`source_document_chunks`)
3. **Analyse IA** → extraction d'entités (`source_document_entities`)
4. **Mapping** → correspondance champs ↔ tables (`source_document_mappings`)
5. **Scoring** → calcul de confiance par champ
6. **Proposition** → affichage dans DocumentsCenter pour revue
7. **Validation** → acceptation/rejet champ par champ
8. **Propagation** → écriture dans les tables cibles

## Hiérarchie des sources

1. Édition manuelle utilisateur (priorité max)
2. Document validé par l'utilisateur
3. Document brut non validé
4. Suggestion IA

## Provenance des champs

Chaque champ pré-rempli est tracé dans `field_provenance` :
- `source_document_id` : document d'origine
- `source_passage` : extrait textuel source
- `extraction_confidence` : score 0-1
- `extraction_date` : horodatage
- `document_version` : version du document
- `status` : `auto_filled` | `user_confirmed` | `user_rejected` | `user_edited`

## Seuils de confiance

| Score | Action |
|-------|--------|
| ≥ 0.85 | Pré-remplissage automatique |
| 0.60 – 0.84 | Proposition à valider |
| < 0.60 | Suggestion visible, non appliquée |

## Types de fichiers supportés

- PDF (texte natif)
- DOCX
- TXT
- Markdown
- RTF (extensible)

## Versioning

- Chaque réimport crée une nouvelle version
- Comparaison entre versions
- Détection des changements
- Proposition de mise à jour des champs impactés
- Protection des overrides manuels
