## Analyse post-lecture du code

### Ce qui est DÉJÀ implémenté (contrairement à l'analyse initiale)
- ✅ **Provider integrations** : Runway Gen-4.5, Act-Two, Aleph, Luma Ray-2, Photon, Veo 3.1/Lite, Nano Banana 2/Pro, OpenAI GPT Image — tous avec vrais appels API
- ✅ **Validate-asset** : Juge IA via Lovable AI (Gemini 2.5 Flash) avec tool calling structuré, scores multi-axes, anomalies catégorisées
- ✅ **Check-shot-status** : Polling réel pour tous les providers (Runway, Luma, Veo, Sora2) avec retry et stale timeout
- ✅ **Assemble-rough-cut** : Logique de placement séquentiel avec respect des clips verrouillés

### Ce qui MANQUE réellement

#### 1. Candidate Ranking dans Auto-Assembly
**Fichier** : `supabase/functions/assemble-rough-cut/index.ts`
- Actuellement : les clips sont placés séquentiellement sans scoring
- **À ajouter** : 
  - Scoring des candidats par scène (validation score, provider tier, freshness)
  - Sélection du meilleur candidat quand plusieurs shots existent pour une même scène
  - Tri par score décroissant avant placement

#### 2. Review Gate Cascade / Stale Invalidation  
**Fichier** : `src/hooks/useReviewGates.ts` + nouvelle edge function
- Actuellement : les gates sont indépendantes, pas de cascade
- **À ajouter** :
  - Matrice de dépendances entre gates (character_pack → scene_plan → scene_clips → rough_cut → fine_cut → final_export)
  - Quand une gate amont est rejetée ou régénérée → invalider toutes les gates en aval
  - Mutation `useInvalidateDownstreamGates`

#### 3. Timeline Locking après approbation
**Fichier** : `supabase/functions/assemble-rough-cut/index.ts` + `src/hooks/useReviewGates.ts`
- Actuellement : les clips ont un champ `locked` mais rien ne le toggle automatiquement
- **À ajouter** :
  - Quand rough_cut gate → approved : verrouiller tous les clips de la timeline
  - Quand fine_cut gate → approved : verrouiller la timeline elle-même (status: locked)
  - Empêcher la suppression/modification de clips verrouillés côté hook

#### 4. Incident auto-population
**Fichier** : Modifier les edge functions critiques (generate-shots, validate-asset, stitch-render)
- Actuellement : les erreurs sont loggées mais pas insérées dans la table `incidents`
- **À ajouter** :
  - Helper `createIncident()` réutilisable
  - Insertion automatique dans `incidents` quand un shot échoue définitivement, une validation bloque, ou un render échoue

#### 5. Upload base64 vers Storage
**Fichier** : `supabase/functions/generate-shots/index.ts`
- Actuellement : les images Nano Banana retournent des data URIs base64 (énormes, pas persistées)
- **À ajouter** :
  - Upload automatique des base64 dans le bucket `shot-outputs`
  - Remplacement du data URI par l'URL publique du storage
