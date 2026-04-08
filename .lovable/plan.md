

# Premium Pricing Redesign

## Summary
Complete pricing overhaul: new Stripe products/prices at 99€/499€/999€, redesigned Pricing page and homepage summary with premium positioning, updated webhook credit logic, and new credit packs aligned with professional pricing.

---

## What Changes

### 1. Create New Stripe Products & Prices

Create 3 new subscription products + 3 new credit packs in Stripe:

| Product | Price | Credits/month |
|---------|-------|---------------|
| Saga Studio — Auteur | 99 €/month (9900 cents EUR) | 500 |
| Saga Studio — Production | 499 €/month (49900 cents EUR) | 3 000 |
| Saga Studio — Studio | 999 €/month (99900 cents EUR) | 10 000 |

New credit packs (one-time):

| Pack | Price |
|------|-------|
| 500 crédits | 49 € |
| 2 000 crédits | 149 € |
| 5 000 crédits | 299 € |

Old Stripe products remain (for existing subscribers) but are no longer offered on the pricing page.

### 2. Rewrite `src/pages/Pricing.tsx`

Complete rewrite with premium design:

- **Header**: "Une plateforme de production, pas un gadget IA" with editorial subtitle about multi-stage pipeline value
- **No free tier on pricing page** — replaced by "Essai Découverte" (trial framing: 10 credits, 1 project, no card required)
- **3 premium plan cards** with richer feature descriptions organized by category (Ingestion, Production, Timeline, Export, Support)
- **Recommended badge on Production (499€)**
- **Enterprise CTA section** at bottom: "Besoin d'un setup sur mesure ?" with contact link
- **Credit usage model section**: explains monthly reset, no rollover, overage via packs
- **Updated STRIPE_CONFIG** with new price_id/product_id values
- **Updated credit pack section** with new packs at 49€/149€/299€
- Premium typography: larger plan names, editorial spacing, muted category labels

**Plan card content:**

**Auteur — 99€/mois** (500 crédits)
- 2 projets actifs
- Ingestion documentaire (DOCX, PDF)
- Extraction canonique
- Timeline + Rough Cut
- Review Gates
- Export Full HD (1080p)
- Diagnostics standard
- Support email

**Production — 499€/mois** (3 000 crédits) — Recommended
- 10 projets actifs
- Tout Auteur +
- Fine Cut + Finishing
- Export 4K
- Multi-provider (Runway, Luma, Veo)
- Gouvernance projet complète
- Diagnostics avancés
- Priorité de génération
- Support prioritaire

**Studio — 999€/mois** (10 000 crédits)
- Projets illimités
- Tout Production +
- File d'attente prioritaire maximale
- Export 4K HDR
- Anti-aberration multi-pass
- QC automatisé complet
- Contrôle de continuité
- Support dédié
- Onboarding personnalisé

### 3. Rewrite `src/components/PricingSummary.tsx`

Homepage pricing section updated to match:
- New plan names (Auteur / Production / Studio)
- New prices (99€ / 499€ / 999€)
- Condensed professional features (4-5 per plan)
- Premium messaging: "Infrastructure de production professionnelle"
- Trial framing instead of "Gratuit"

### 4. Update `supabase/functions/stripe-webhook/index.ts`

Update credit logic to handle new price tiers:
- Current: `≤ 2000 cents → 100 credits, else → 500 credits`
- New: Map by amount ranges to 500 / 3000 / 10000 credits
- Update `CREDIT_PACKS_BY_CENTS` for new pack prices (4900/14900/29900 cents)

### 5. Update `supabase/functions/create-checkout/index.ts`

No structural changes needed — it already accepts any `price_id`. Just redeploy after webhook changes.

---

## Execution Order

1. Create 6 Stripe products+prices (3 subscriptions + 3 packs)
2. Rewrite `Pricing.tsx` with new IDs and premium design
3. Rewrite `PricingSummary.tsx` homepage section
4. Update `stripe-webhook` credit mapping
5. Deploy edge functions

## Files Modified
- `src/pages/Pricing.tsx` — full rewrite
- `src/components/PricingSummary.tsx` — full rewrite
- `supabase/functions/stripe-webhook/index.ts` — credit tier logic

## Technical Notes
- Old Stripe prices remain active for existing subscribers — no breaking change
- `check-subscription` uses `product_id` matching — will work with new IDs automatically
- Currency set to EUR (not USD as current products)
- Free trial keeps 10 credits via `handle_new_user()` — no change needed

