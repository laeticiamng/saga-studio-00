# Sécurité — Politique et pratiques

## Secrets

- `.env` est exclu du versioning via `.gitignore`
- Seul `.env.example` est commité (sans valeurs réelles)
- Les clés Supabase service role ne sont jamais exposées côté client
- Les clés API providers (OpenAI, Runway, Luma) sont dans le dashboard Supabase

## Authentification

- Auth gérée par Supabase Auth (JWT)
- Chaque edge function valide le JWT via `supabase.auth.getUser()`
- Le `service_role_key` est uniquement utilisé côté serveur (edge functions)
- Le client frontend utilise uniquement la `anon key`

## Autorisation

### Row Level Security (RLS)

Toutes les tables ont RLS activé. Patterns :

1. **Données utilisateur** : l'utilisateur voit uniquement ses projets et données liées
   ```sql
   USING (projects.user_id = auth.uid()::text)
   ```

2. **Données admin** : les admins voient tout
   ```sql
   USING (public.has_role(auth.uid(), 'admin'))
   ```

3. **Données publiques** : certaines tables sont lisibles par tous
   ```sql
   FOR SELECT USING (true)
   ```

### Rôles

- `user` : accès standard (ses projets, séries, épisodes)
- `moderator` : accès étendu
- `admin` : accès complet + admin pages

## Rate Limiting

- `create-series` : 3 requêtes par minute par utilisateur
- Pattern : Map en mémoire avec window de 60 secondes

## Feature Flags

Les fonctionnalités sont contrôlées via `feature_flags` :
- `series_enabled` : active la création de séries
- `agent_system_enabled` : active l'orchestration d'agents
- `review_workflows_enabled` : active les workflows de revue

## CORS

Toutes les edge functions ont des headers CORS permissifs pour le développement. En production, restreindre `Access-Control-Allow-Origin` au domaine de l'application.

## Audit

Toutes les actions significatives sont loguées dans `audit_logs` avec :
- `user_id` : qui a fait l'action
- `action` : type d'action
- `entity_type` / `entity_id` : cible de l'action
- `details` : contexte JSONB
- `ip_address` : adresse IP
- `correlation_id` : pour tracer les flux multi-étapes
