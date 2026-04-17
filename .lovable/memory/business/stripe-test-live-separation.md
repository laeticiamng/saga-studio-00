---
name: Stripe test/live price separation
description: STRIPE_CONFIG centralisé dans src/config/stripe.ts avec bascule auto test/live
type: feature
---

Les `price_id` et `product_id` Stripe sont centralisés dans `src/config/stripe.ts`.

Sélection automatique :
- `import.meta.env.PROD === true` → IDs LIVE
- sinon (dev/preview) → IDs TEST si renseignés, sinon fallback LIVE

Override manuel via `VITE_STRIPE_MODE=test|live`.

Quand `STRIPE_MODE === "test"`, un bandeau jaune s'affiche en haut de `/pricing` pour avertir l'utilisateur qu'aucun paiement réel n'est effectué.

**TODO opérationnel** : créer les prix correspondants dans le dashboard Stripe TEST et coller les IDs dans `TEST` du fichier `src/config/stripe.ts`. Tant que les IDs TEST restent vides, le système utilise LIVE de manière transparente (fail-safe).
