

# Audit complet pré-production — CineClip AI

---

## 1. SECURITE (Critique)

### 1.1 Edge Functions sans JWT
**Toutes les 14 edge functions** ont `verify_jwt = false`. Cela signifie que n'importe qui peut appeler directement :
- `create-project` — creer des projets sans auth
- `pipeline-worker` — lancer des pipelines sur n'importe quel projet
- `generate-shots`, `plan-project`, `analyze-audio` — consommer des ressources sans controle
- `stitch-render`, `check-shot-status` — manipuler des projets d'autres utilisateurs

**Seules** `admin-actions` et `check-subscription`/`customer-portal`/`create-checkout` valident le token dans le code. Les fonctions pipeline (`pipeline-worker`, `generate-shots`, `plan-project`, `analyze-audio`, `stitch-render`, `check-shot-status`) sont appelees avec le service role key mais ne verifient **pas** l'appelant.

**Action requise** : Au minimum, les fonctions appelees depuis le front (`create-project`, `estimate-cost`, `project-status`) doivent valider le JWT dans le code. Les fonctions internes (appelees par `pipeline-worker`) pourraient rester sans JWT si elles ne sont jamais appelees directement par le client.

### 1.2 ShareView bypass RLS
`ShareView.tsx` (ligne 15) tente de lire `renders` et `projects` sans auth. Or les RLS requierent `auth.uid()`. Cela signifie que la page de partage **ne fonctionnera jamais** pour un visiteur non connecte.

**Action requise** : Ajouter une politique RLS publique pour les projets "completed" sur `renders` et `projects` (SELECT uniquement, colonnes limitees), ou creer une edge function dediee au partage.

### 1.3 CORS trop permissif
Toutes les fonctions utilisent `Access-Control-Allow-Origin: *`. Acceptable en dev, a restreindre au domaine de production.

### 1.4 Stripe webhook non securise correctement
`stripe-webhook` a `verify_jwt = false` (correct pour les webhooks), mais si la variable `STRIPE_WEBHOOK_SECRET` est absente, le webhook accepterait potentiellement des payloads non verifies.

### 1.5 Admin check cote client
`Admin.tsx` ligne 114-122 verifie le role admin via une query RLS cote client. C'est correct car l'edge function `admin-actions` reverifie cote serveur. Pas de faille ici.

---

## 2. BUGS FONCTIONNELS

### 2.1 URL.createObjectURL sans cleanup
`CreateClip.tsx` cree des object URLs (lignes 202, 232) sans jamais les revoquer (`URL.revokeObjectURL`). Fuite memoire qui s'accumule quand l'utilisateur ajoute/supprime des fichiers.

### 2.2 CreateFilm ne debite pas les credits
`CreateFilm.tsx` insere directement dans `projects` sans appeler `debit_credits`. Le clip passe par le pipeline worker qui debite, mais le film debite-t-il via la meme voie ? Le status initial est `"planning"` — le `pipeline-worker` attend `"analyzing"` ou `"planning"` et appellera `plan-project`, qui ne debite pas non plus. **Aucun debit de credits n'a lieu pour les films.**

### 2.3 CreateClip contourne `create-project`
`CreateClip.tsx` insere directement dans `projects` (ligne 111-124) au lieu d'appeler l'edge function `create-project` qui gere le debit de 5 credits. Resultat : **les clips ne debitent pas les credits a la creation**.

### 2.4 Face references et ref photos non transmises au pipeline
Les URLs des visages et photos de reference sont uploadees dans le storage mais **jamais enregistrees dans le projet ni transmises au pipeline**. Elles sont perdues.

### 2.5 Aspect ratio ignore
La valeur `aspectRatio` selectionnee dans CreateClip et CreateFilm n'est stockee nulle part dans la table `projects` et n'est pas utilisee par le pipeline.

### 2.6 Auth redirect dans le render
`Auth.tsx` ligne 23-26 fait `navigate()` directement dans le corps du composant (pas dans un `useEffect`). Cela provoque un warning React "Cannot update during render".

---

## 3. INTEGRITE DES DONNEES

### 3.1 FK manquantes
Les foreign keys suivantes ne sont pas presentes dans le schema (d'apres les metadata) :
- `shots.project_id` → `projects.id`
- `renders.project_id` → `projects.id`
- `plans.project_id` → `projects.id`
- `audio_analysis.project_id` → `projects.id`
- `credit_ledger.user_id` → `auth.users.id`

Meme si les migrations les ont ajoutees, le schema rapporte `<foreign-keys>` vide pour toutes ces tables. A verifier.

### 3.2 Trigger `validate_render_completion` presente dans les fonctions mais absente des triggers
Le schema indique "There are no triggers in the database". Le trigger n'est donc **pas actif** — la validation render est inoperante.

### 3.3 Trigger `handle_new_user` pour l'onboarding
La fonction existe mais aucun trigger n'est declare. Si le trigger a ete cree dans une migration mais non detecte, c'est un risque : les nouveaux utilisateurs pourraient ne pas recevoir leur wallet + role initial.

---

## 4. PERFORMANCE

### 4.1 Admin dashboard requetes excessives
`Admin.tsx` fait 7 requetes simultanees (projects, jobs, renders, flags, ledger, wallets, profiles) sans pagination reelle. Avec la croissance des donnees, cela deviendra lent. Le `refetchInterval: 10000` sur jobs aggrave la charge.

### 4.2 check-subscription appele en boucle
Les logs reseau montrent `check-subscription` appele 4 fois consecutives en 3 secondes. Le `AuthContext` l'appelle depuis `onAuthStateChange` ET `getSession`, causant des appels dupliques.

### 4.3 Pas d'index sur les colonnes frequemment filtrees
`shots.project_id`, `shots.status`, `job_queue.project_id`, `job_queue.status`, `credit_ledger.ref_id` — aucun index specifique n'est mentionne au-dela des PKs.

---

## 5. UX / LOCALISATION

### 5.1 Textes anglais residuels
- Status dans le dashboard admin : `"completed"`, `"processing"`, `"pending"`, `"failed"`, etc. affiches en anglais dans les badges
- `Dashboard.tsx` ligne 99 : `{project.type}` affiche `"clip"` ou `"film"` en anglais
- `Dashboard.tsx` ligne 112 : `"Pas de style"` est correct, mais le style preset est affiche en anglais (ex: `"cinematic"`)
- `ShareView.tsx` ligne 62 : `{project.type}` et `{project.style_preset}` en anglais

### 5.2 Polices non chargees
`index.css` reference `'Syne'` et `'Space Grotesk'` comme polices display/body, mais aucun `@import` Google Fonts ni fichier de police locale n'est present dans `index.html` ou les CSS. Les polices retombent sur les generiques sans-serif.

---

## 6. DEPLOIEMENT / INFRA

### 6.1 Pas de rate limiting
Aucune des edge functions n'a de rate limiting. Un acteur malveillant peut spam `estimate-cost`, `pipeline-worker`, ou `create-project` sans limite.

### 6.2 Pas de monitoring/alerting
Aucun systeme de monitoring (logs structures, metriques, alertes) au-dela du dashboard admin maison.

### 6.3 Pas de politique RGPD
Footer mentionne "Confidentialite", "CGU", "Mentions legales" — tous pointent vers `#` (liens morts). Obligatoire pour un lancement en France.

### 6.4 Service FFmpeg absent
`stitch-render` cherche `FFMPEG_RENDER_SERVICE_URL` — ce secret n'existe pas. Tous les renders resteront en status `"pending"` indefiniment. La variable est absente des secrets configures.

---

## 7. PLAN D'ACTION PRIORITISE

### P0 — Bloquants production
1. **Corriger le debit credits** : CreateClip et CreateFilm doivent passer par `create-project` edge function ou appeler `debit_credits` RPC
2. **Activer les triggers DB** : `validate_render_completion` et `handle_new_user` doivent etre attaches via migration
3. **Fixer ShareView** : Politique RLS publique ou edge function dediee
4. **Transmettre face/ref URLs au pipeline** : Stocker dans la table `projects` (colonnes a ajouter) ou dans `plans`
5. **Fix Auth.tsx redirect** : Deplacer dans `useEffect`

### P1 — Important
6. **Valider JWT** dans les edge functions exposees au front (create-project, estimate-cost, project-status)
7. **Charger les polices** Syne et Space Grotesk dans `index.html`
8. **Traduire** tous les status et types affiches dans l'admin et le dashboard
9. **Fix double appel** check-subscription dans AuthContext
10. **Ajouter indexes DB** sur colonnes filtrees frequemment

### P2 — Ameliorations
11. Cleanup object URLs dans CreateClip
12. Restreindre CORS en production
13. Pages legales (CGU, confidentialite, mentions)
14. Rate limiting sur les edge functions critiques
15. Colonne `aspect_ratio` dans `projects` + transmission au pipeline

