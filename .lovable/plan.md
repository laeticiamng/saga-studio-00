

# AUDIT TECHNIQUE COMPLET -- CineClip AI

---

## 1. RESUME EXECUTIF

**Etat global** : Plateforme structurellement bien construite (routing, auth, RLS, pipeline) mais avec des failles de securite critiques, des edge functions non enregistrees dans config.toml, et une absence totale d'observabilite. Le produit est un MVP fonctionnel mais PAS pret pour un go-live public.

**Verdict go-live** : **NON EN L'ETAT**

### 5 P0 principaux

1. **Toutes les edge functions ont `verify_jwt = false`** -- n'importe qui peut appeler `admin-actions`, `create-project`, `pipeline-worker`, `generate-shots` sans authentification JWT. L'auth est faite manuellement dans le code mais le framework de securite Supabase est contourne.
2. **`send-contact`, `dispatch-webhooks`, `cleanup` absents de `config.toml`** -- ces fonctions ne seront pas deployees ou utiliseront les defaults. `send-contact` peut echouer en production.
3. **`admin-actions` avec `verify_jwt = false`** -- endpoint critique d'administration (refund credits, cancel projects, stats) accessible publiquement. L'auth manuelle dans le code est le seul rempart. Un bug = acces admin total.
4. **CORS `Access-Control-Allow-Origin: *`** sur toutes les edge functions -- autorise les appels depuis n'importe quel domaine. Acceptable en dev, risque en production.
5. **`projects` table : SELECT policy `Public can view completed projects basic info`** expose `face_urls`, `user_id`, `audio_url`, `synopsis` sur tous les projets completed. Donnees biometriques accessibles publiquement.

### 5 P1 principaux

1. **Credit wallet query mal construite** : `credit_wallets?select=balance&id=eq.{user_id}` envoie le user_id dans la query string toutes les ~60s. Polling excessif visible dans les network logs (12+ requetes identiques).
2. **Resend `from: onboarding@resend.dev`** -- adresse par defaut. Les emails de contact et notifications seront marques comme spam ou rejetes.
3. **Mentions legales incompletes** : SIRET, raison sociale, adresse physique, directeur de publication manquants. Non conforme RGPD/loi francaise.
4. **Aucune observabilite** : pas de Sentry, pas de health check, pas de monitoring, pas d'analytics, pas de logs structures cote frontend.
5. **Admin page `/admin` accessible par URL directe** : le `ProtectedRoute` ne verifie que `user`, pas `isAdmin`. N'importe quel utilisateur authentifie atteint la page (la donnee est protegee par RLS mais l'UI est exposee).

---

## 2. TABLEAU D'AUDIT

| Priorite | Domaine | Page/Route/Fonction | Probleme | Symptome | Risque | Recommandation | Faisable dans Lovable ? |
|----------|---------|---------------------|----------|----------|--------|----------------|------------------------|
| P0 | Security | config.toml | Tous `verify_jwt = false` | Toutes les EF sont publiques | Acces non autorise a toutes les operations | Mettre `verify_jwt = true` sur toutes les fonctions sauf `stripe-webhook` | Oui |
| P0 | Security | config.toml | `send-contact`, `dispatch-webhooks`, `cleanup` non declares | Fonctions potentiellement non deployees | Contact form casse en prod | Ajouter les declarations dans config.toml | Oui |
| P0 | Security | admin-actions | Endpoint admin sans JWT verify | N'importe qui peut POST | Refund credits, cancel projects | verify_jwt = true + garder check auth dans le code | Oui |
| P0 | RLS | projects table | SELECT public sur projets completed expose face_urls, user_id | Requete anon peut lire toutes les colonnes | Fuite de donnees biometriques | Supprimer la policy `Public can view completed projects basic info` et forcer l'utilisation de `projects_public` view | Oui (migration) |
| P0 | Security | pipeline-worker, generate-shots | verify_jwt = false | Appels externes possibles | Generation non autorisee, debit de credits | verify_jwt = true | Oui |
| P1 | Auth | /admin route | ProtectedRoute ne verifie pas le role | User auth non-admin voit la page admin (donnees protegees par RLS) | UX confuse, tentatives d'acces | Creer AdminRoute avec check role | Oui |
| P1 | Performance | CreditDisplay | Polling credit_wallets toutes les ~60s | 12+ requetes identiques dans les logs | Charge DB inutile | Utiliser refetchInterval ou staleTime | Oui |
| P1 | Billing | Pricing.tsx | Stripe price_ids hardcodes | Non confirmable si live vs test | Double paiement, echec checkout | Verifier coherence avec Stripe dashboard | Non (necessite acces Stripe) |
| P1 | Email | send-contact, dispatch-webhooks | from: onboarding@resend.dev | Emails marques spam | Notifications perdues | Configurer domaine custom Resend | Non (config Resend externe) |
| P1 | Go-live | Legal.tsx | SIRET, adresse, directeur manquants | Page incomplete | Non conformite legale | Completer avec vraies infos | Oui (si infos fournies) |
| P2 | Frontend | Console | 3 warnings React Router v7 future flags | Warnings en console | Dette technique | Ajouter future flags au Router | Oui |
| P2 | Frontend | Console | Warning framer-motion container position | Warning scroll offset | Animation potentiellement cassee | Ajouter `position: relative` au container | Oui |
| P2 | SEO | Toutes pages sauf Index | Canonical pointe vers saga-studio-00.lovable.app | URL en dur dans index.html | SEO dilue | Mettre a jour ou rendre dynamique | Oui |
| P2 | Performance | Index.tsx | hero-cinema.jpg probablement non optimise | Image plein ecran chargee sans lazy | LCP lent | WebP + lazy loading | Oui |
| P2 | Accessibility | Formulaires | Labels presents mais pas de gestion aria-invalid | Erreurs non liees aux champs | Accessibilite degradee | Ajouter aria-invalid + aria-describedby | Oui |
| P3 | i18n | Toute la plateforme | Francais uniquement, aucun i18n | Textes hardcodes | Marche limite | Pas de changement necessaire si mono-langue | N/A |
| P3 | Observability | Global | Aucun monitoring, Sentry, analytics | Pas de visibilite prod | Bugs silencieux en prod | Integrer Sentry ou equivalent | Oui (partiel) |

---

## 3. DETAIL PAR CATEGORIE

### A. Frontend & rendu
**Fonctionne** : Toutes les routes rendent correctement. Code-splitting en place. ErrorBoundary global present. 404 bien geree. Loading states presents partout. Dark mode fonctionne.
**Cassé** : Rien de casse cote rendu.
**Douteux** : Warning framer-motion `position` container. 3 warnings React Router future flags.

### B. QA fonctionnelle
**Fonctionne** : Auth flow (login/signup/reset/logout). Dashboard charge les projets. Creation clip/film avec formulaires complets. Settings avec profil, webhooks, credits. CookieBanner avec accept/refuse.
**Cassé** : Rien de visuellement casse.
**Douteux** : Le pipeline de generation video depend de providers externes (Sora, Runway, Luma, Veo). Le `MockProvider` est le fallback par defaut -- en prod, les videos generees seront des mocks si les API keys ne fonctionnent pas. Non confirmable sans test real.

### C. Auth & autorisations
**Fonctionne** : ProtectedRoute redirige vers /auth. Session persistee. Logout fonctionne. RLS protege les donnees par user. Admin page verifie le role via RPC `has_role` cote donnees.
**Cassé** : `/admin` accessible a tout utilisateur authentifie (la page charge, verifie ensuite le role et affiche "Acces refuse" -- mais le composant et les queries sont deja montes).
**Douteux** : Google OAuth via `lovable.auth.signInWithOAuth` -- non confirmable sans test.

### D. APIs & edge functions
**Fonctionne** : `create-project`, `check-subscription`, `create-checkout`, `admin-actions`, `pipeline-worker` implementent l'auth manuellement dans le code.
**Cassé** : `send-contact`, `dispatch-webhooks`, `cleanup` non declares dans `config.toml`.
**Douteux** : Rate limiting en memoire (edge functions stateless = reset a chaque cold start). Inefficace en production.

### E. Database & RLS
**Fonctionne** : RLS bien configuree sur la majorite des tables. `credit_wallets` et `credit_ledger` proteges contre les modifications directes. `debit_credits` et `topup_credits` avec idempotence. `has_role` en SECURITY DEFINER avec search_path fixe.
**Cassé** : Policy `Public can view completed projects basic info` expose toutes les colonnes de `projects` (dont `face_urls`, `user_id`, `audio_url`).
**Douteux** : `renders` table a une policy `Public can view completed renders` -- expose `logs` qui peut contenir des infos internes.

### F. Securite
- Toutes les edge functions ont `verify_jwt = false` : risque majeur.
- CORS `*` partout : acceptable en dev, a restreindre en prod.
- Rate limiting in-memory sur edge functions : inefficace car stateless.
- `admin-actions` publiquement accessible (auth manuelle dans le code comme seule protection).
- Stripe webhook verifie la signature (`stripe.webhooks.constructEvent`) : correct.
- Webhook endpoints secrets generes avec `gen_random_bytes(32)` et signes HMAC : correct.

### G. Paiement & billing
**Fonctionne** : Page pricing avec plans et packs. Checkout via edge function. Customer portal via edge function. Subscription check fonctionne.
**Non confirme** : Price IDs Stripe en live vs test. Integration Stripe end-to-end.
**Douteux** : `stripe-webhook` a `verify_jwt = false` (correct pour les webhooks Stripe).

### H. Performance
- Hero image chargee sans optimisation visible.
- Code-splitting en place (React.lazy).
- `credit_wallets` polling excessif (~toutes les 60s pour la meme donnee).
- Pas de service worker, pas de cache strategy visible.

### I. SEO
- `title`, `meta description`, `og:*`, `twitter:*` presents dans index.html.
- `canonical` hardcode sur `saga-studio-00.lovable.app`.
- `sitemap.xml` et `robots.txt` presents.
- `usePageTitle` hook sur toutes les pages.
- Pas de structured data (schema.org).

### J. Accessibilite
- Labels de formulaires presents.
- Pas de gestion `aria-invalid` sur les erreurs.
- Focus visible via Tailwind defaults.
- Modales fermables (Radix UI).
- Mobile responsive present.

### K. Observabilite
- Zero monitoring en production. Pas de Sentry. Pas d'analytics. Pas de health endpoint.
- `console.error("[ErrorBoundary]")` comme seule trace d'erreur.
- Edge functions avec `console.error`/`console.log` uniquement.

---

## 4. PLAN D'ACTION PRIORISE

### P0 -- Correctifs immediats
1. **Ajouter `send-contact`, `dispatch-webhooks`, `cleanup` dans `config.toml`** avec `verify_jwt = false` (send-contact est public, les autres sont appeles par le backend).
2. **Supprimer la RLS policy `Public can view completed projects basic info`** sur la table `projects` -- forcer l'usage de `projects_public` view.
3. **Mettre `verify_jwt = true`** sur `create-project`, `admin-actions`, `pipeline-worker`, `generate-shots`, `plan-project`, `check-shot-status`, `stitch-render`, `estimate-cost`, `create-checkout`, `check-subscription`, `customer-portal`, `project-status`, `analyze-audio`. Garder `verify_jwt = false` uniquement pour `stripe-webhook`, `send-contact`.

### P1 -- Correctifs rapides
4. **Creer un composant `AdminRoute`** qui verifie le role admin avant de monter la page.
5. **Ajouter `staleTime` et `refetchInterval`** sur la query `credit_wallets` pour reduire le polling.
6. **Supprimer la policy `Public can view completed renders`** sur `renders` (expose `logs`).

### P2 -- Ameliorations
7. Ajouter les React Router future flags.
8. Optimiser hero image (format WebP, lazy loading).
9. Ajouter `position: relative` sur le container framer-motion.

### P3 -- Polish
10. Integrer un service de monitoring (Sentry).
11. Ajouter structured data schema.org sur la homepage.
12. Completer les mentions legales.

---

## 5. IMPLEMENTATION IMMEDIATE

Les corrections suivantes seront implementees :

1. **config.toml** : Ajouter `send-contact`, `dispatch-webhooks`, `cleanup`. Passer toutes les fonctions authentifiees a `verify_jwt = true` sauf `stripe-webhook` et `send-contact`.
2. **Migration SQL** : Supprimer la policy `Public can view completed projects basic info` sur `projects`. Restreindre `Public can view completed renders` pour ne pas exposer `logs`.
3. **AdminRoute component** : Creer un guard specifique pour `/admin` qui verifie le role.
4. **CreditDisplay** : Ajouter `staleTime: 30000` et `refetchInterval: 60000` pour reduire les requetes.
5. **React Router future flags** : Ajouter `v7_startTransition` et `v7_relativeSplatPath`.

### Ce qui NE SERA PAS implementé (necessite decisions externes) :
- Configuration domaine Resend (necessite acces Resend dashboard)
- Verification des Stripe price IDs live vs test (necessite acces Stripe dashboard)
- Mentions legales completes (necessite infos juridiques)
- Sentry/monitoring (necessite compte et DSN)
- Remplacement de l'image hero par WebP (necessite l'asset)

