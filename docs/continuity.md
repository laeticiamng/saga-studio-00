# Continuité — Mémoire de série

## Concept

Le système de continuité maintient un graphe de mémoire qui capture tous les faits de la série (personnages, lieux, costumes, accessoires, événements, relations). Chaque épisode est vérifié contre ce graphe avant de progresser.

## Architecture

```
continuity_memory_nodes (noeuds du graphe)
  ├── node_type: character | location | prop | costume | event | relationship | visual_style | music_theme
  ├── label: nom lisible
  ├── properties: JSONB (détails)
  └── first/last_appearance_episode

continuity_memory_edges (relations)
  ├── edge_type: interacts_with | wears | located_at | owns | transforms_to | conflicts_with | depends_on
  ├── source_node_id → target_node_id
  └── valid_from/until_episode

continuity_conflicts (problèmes détectés)
  ├── conflict_type: character_appearance | costume_change | prop_inconsistency | location_error | timeline_error | dialogue_contradiction | visual_mismatch
  ├── severity: info | warning | error | critical
  └── resolved: boolean
```

## Flux de vérification

1. Le `continuity_checker` agent reçoit l'épisode et la mémoire existante
2. Il compare le contenu de l'épisode avec le graphe
3. Il détecte les conflits (changements d'apparence, incohérences de costume, erreurs de timeline)
4. Il propose de nouveaux faits à ajouter au graphe
5. Les conflits sont stockés dans `continuity_conflicts`
6. Les nouveaux faits sont ajoutés comme nodes dans le graphe
7. Un `continuity_report` est créé avec le verdict (pass/flag/block)

## Types de conflits détectés

- **character_appearance** : changement non justifié de l'apparence d'un personnage
- **costume_change** : costume différent sans explication narrative
- **prop_inconsistency** : accessoire qui apparaît/disparaît sans raison
- **location_error** : lieu décrit différemment entre épisodes
- **timeline_error** : événements dans le mauvais ordre chronologique
- **dialogue_contradiction** : information contradictoire dans les dialogues
- **visual_mismatch** : incohérence de style visuel

## UI

Le ContinuityCenter (`/series/:id/continuity`) affiche :
- Statistiques (noeuds, relations, conflits actifs/résolus)
- Liste des conflits avec sévérité et description
- Graphe de mémoire organisé par type de noeud
- Relations entre noeuds
