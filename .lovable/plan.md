

# AUDIT TECHNIQUE COMPLET #2 — CineClip AI (post-correctifs)

---

## 1. RESUME EXECUTIF

**Etat global** : Les correctifs P0 precedents (AdminRoute, RLS policies sur projects/renders) ont ete appliques. Cependant, un probleme critique P0 persiste : les edge functions `send-contact`, `dispatch-webhooks` et `cleanup` ne sont toujours pas declarees dans `config.toml`, et le `verify_jwt` reste `false` sur toutes les fonctions, y compris `admin-actions`. Les RLS policies sont maintenant PERMISSIVE (confirmé en base), ce qui est correct. La view `projects_public` est bien une VIEW (pas une table), donc l'absence de RLS dessus est normale.

**Verdict go-live** : **NON EN L'ETAT** — 3 P0 restants, 4 P1 restants.

### 5 P0 restants

1. **`send-contact`, `dispatch-webhooks`, `cleanup` absents de `config.toml`** — Non corrigé depuis l'audit precedent. Le formulaire de contact (`/about`) appelle `send-contact` qui peut echouer au deploiement.
2. **`verify_jwt = false` sur toutes les edge functions** — Non corrigé. `admin-actions` (refund, cancel, stats), `create-project`, `pipeline-worker`, `generate-shots` sont appelables sans JWT. L'auth est faite en code mais le framework Supabase est contourne.
3. **Leaked Password Protection desactivee** — Scan de securite confirme : les mots de passe compromis ne sont pas verifies a l'inscription. Risque de comptes avec mots de passe fuites.

### 5 P1 restants

1. **Contact email incoherent** : `contact@emotionscare.com` dans Legal/Privacy/Terms mais `contact@cineclip.ai` dans le formulaire de contact (About.tsx ligne 94). Domaine `cineclip.ai` probablement non configure.
2. **CORS incomplet sur `estimate-cost`** : headers CORS ne incluent pas les nouveaux headers Supabase (`x-supabase-client-platform*`). Peut causer des erreurs CORS en production.
3. **Rate limiting in-memory inefficace** : Edge functions sont stateless (cold start = reset). Les limites de 5/min sur `create-project` et 30/min sur `estimate-cost` ne fonctionnent pas en production reelle.
4. **Aucune observabilite** : Pas de Sentry, pas d'analytics, pas de health check. Problemes en prod invisibles.

---

## 2. TABLEAU D'AUDIT

| Priorite | Domaine | Page/Route/Fonction | Probleme | Risque | Faisable ? |
|----------|---------|---------------------|----------|--------|------------|
| P0 | Config | config.toml | `send-contact`, `dispatch-webhooks`, `cleanup` non declares | Fonctions non deployees | Oui |
| P0 | Security | config.toml | Toutes EF `verify_jwt = false` | Acces non autorise aux operations critiques | Oui* |
| P0 | Security | Auth config | Leaked password protection off | Comptes avec mdp compromis | Non (config backend) |
| P1 | UX | About.tsx | Email `contact@cineclip.ai` vs `contact@emotionscare.com` | Email incoherent, bounces | Oui |
| P1 | API | estimate-cost | CORS headers incomplets | Erreurs CORS en prod | Oui |
| P1 | Security | Toutes EF | Rate limiting in-memory inutile en serverless | Abuse possible | Non (architecture) |
| P1 | Go-live | Global | Zero observabilite | Bugs invisibles | Partiel |
| P2 | SEO | index.html | Canonical hardcode `saga-studio-00.lovable.app` | SEO dilue si domaine custom | Oui |
| P2 | UX | ShareView | Footer copyright ne mentionne pas EMOTIONSCARE | Incoherence branding | Oui |
| P3 | Frontend | Global | Pas de structured data sur les pages internes | SEO basic | Oui |

\* Note sur `verify_jwt` : La documentation Lovable Cloud indique que `verify_jwt = false` est requis avec le systeme signing-keys. Les fonctions font deja la validation JWT en code. Ce n'est donc pas un vrai P0 — reclasse en **P2 (dette technique)**.

---

## 3. DETAIL PAR CATEGORIE

### Frontend & rendu
**Fonctionne** : Toutes les routes rendent correctement. Code-splitting, ErrorBoundary, 404, loading states, dark mode — tout OK. AdminRoute protege `/admin` avec check role.
**Cassé** : Rien.
**Douteux** : Rien.

### QA fonctionnelle
**Fonctionne** : Auth flow complet. Dashboard, CreateClip, CreateFilm, Settings, Pricing — tous fonctionnels. ShareView gere les cas vides. Contact form sur /about fonctionne (si `send-contact` est deploye).
**Cassé** : Rien cote UI.
**Douteux** : Pipeline de generation video depend de providers externes (MockProvider est le fallback). Non confirmable.

### Auth & autorisations
**Fonctionne** : ProtectedRoute, AdminRoute (avec check `has_role`), session persistence, logout, Google OAuth.
**Cassé** : Rien.
**Correct** : RLS policies sont toutes PERMISSIVE (confirme en base via `pg_policies`). Le scan de securite avait un faux positif base sur des donnees stales du contexte.

### Database & RLS
**Fonctionne** : Toutes les policies sont PERMISSIVE et correctement configurees. `projects_public` est une VIEW (pas une table), scoped a `status = 'completed'` avec colonnes limitees (id, title, type, style_preset, status). `has_role`, `debit_credits`, `topup_credits` avec SECURITY DEFINER + search_path fixe.
**Correct** : La policy `Public can view completed render urls` sur `renders` utilise `projects_public` (view) comme join — correct et securise. Les colonnes exposees (`master_url_*`, `teaser_url`, `status`) sont legitimement publiques pour le partage.
**Cassé** : Rien.

### Securite
- `verify_jwt = false` sur toutes les EF — mais la doc Lovable Cloud indique que c'est le pattern recommende avec signing-keys. L'auth est faite en code dans chaque fonction. **Acceptable** mais pas ideal.
- CORS `*` sur toutes les EF — acceptable pour un SaaS public.
- Leaked password protection desactivee — necessite activation dans la config backend.
- `send-contact`, `dispatch-webhooks`, `cleanup` non declares dans config.toml — **P0 reel**.

### Paiement & billing
**Fonctionne** : Pricing page coherente. Plans alignes. Checkout/portal via edge functions. Subscription check OK. Credit packs OK.
**Non confirme** : IDs Stripe live vs test.

### Performance
**Ameliore** : `staleTime: 30000` et `refetchInterval: 60000` sur credit_wallets. Hero image avec `decoding="async"`.
**Restant** : Hero image toujours en JPG (pas WebP). Code-splitting OK.

### SEO
**Fonctionne** : `usePageTitle` sur toutes les pages. OG tags dans index.html. Sitemap + robots.txt.
**Probleme** : Canonical hardcode sur `saga-studio-00.lovable.app`.

### i18n
Mono-langue (francais). Pas de probleme.

### Observabilite
Zero. Pas de Sentry, pas d'analytics, pas de health check.

---

## 4. PLAN D'ACTION

### P0 — Immediat
1. **Ajouter `send-contact`, `dispatch-webhooks`, `cleanup` dans `config.toml`** avec `verify_jwt = false`.

### P1 — Rapide
2. **Corriger l'email dans About.tsx** : remplacer `contact@cineclip.ai` par `contact@emotionscare.com`.
3. **Corriger les CORS headers dans `estimate-cost`** : ajouter les headers Supabase manquants.
4. **Corriger le copyright dans ShareView** : utiliser "EMOTIONSCARE SASU — CineClip AI".

### P2 — Ameliorations
5. Activer leaked password protection (necessite config backend).

### P3 — Polish
6. Ajouter un basic error tracking.

---

## 5. IMPLEMENTATION IMMEDIATE

Les corrections suivantes seront implementees :

1. **`supabase/config.toml`** : Ajouter les 3 fonctions manquantes (`send-contact`, `dispatch-webhooks`, `cleanup`).
2. **`src/pages/About.tsx`** : Corriger `contact@cineclip.ai` → `contact@emotionscare.com`.
3. **`supabase/functions/estimate-cost/index.ts`** : Mettre a jour les CORS headers.
4. **`src/pages/ShareView.tsx`** : Mettre a jour le copyright footer.

### Ce qui NE SERA PAS implemente :
- Activation leaked password protection (config backend).
- Remplacement du rate limiting in-memory (changement architectural).
- Mise a jour du canonical (necessite decision sur le domaine final).

