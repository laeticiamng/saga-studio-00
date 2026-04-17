/**
 * Stripe price configuration.
 *
 * IDs are split between LIVE (production) and TEST (development/preview)
 * environments to prevent accidental real charges during QA.
 *
 * Selection logic:
 *   - import.meta.env.PROD === true  → LIVE ids
 *   - otherwise                       → TEST ids (fallback to LIVE if not set)
 *
 * To override (e.g. force TEST in prod for staging), set:
 *   VITE_STRIPE_MODE=test
 *
 * NOTE: Test price IDs must be created in the Stripe test dashboard and
 * pasted below. Until then, the test environment safely falls back to LIVE.
 */

interface StripePriceSet {
  plans: {
    auteur: { price_id: string; product_id: string };
    production: { price_id: string; product_id: string };
    studio: { price_id: string; product_id: string };
  };
  packs: {
    500: { price_id: string };
    2000: { price_id: string };
    5000: { price_id: string };
  };
}

const LIVE: StripePriceSet = {
  plans: {
    auteur: { price_id: "price_1TJtJcDFa5Y9NR1IlTybGnC6", product_id: "prod_UIUIkXWSZqelFg" },
    production: { price_id: "price_1TJtJdDFa5Y9NR1IYfvdo7U8", product_id: "prod_UIUIf9JBZRrVwr" },
    studio: { price_id: "price_1TJtJfDFa5Y9NR1IMwMS0gik", product_id: "prod_UIUIp76xgDjTPW" },
  },
  packs: {
    500: { price_id: "price_1TJtJgDFa5Y9NR1I1NtozFfX" },
    2000: { price_id: "price_1TJtJhDFa5Y9NR1ILZR515f0" },
    5000: { price_id: "price_1TJtJiDFa5Y9NR1IYw4X2CBt" },
  },
};

// TODO: paste actual TEST price IDs from Stripe test dashboard.
// As long as these stay empty strings, we transparently fall back to LIVE.
const TEST: StripePriceSet = {
  plans: {
    auteur: { price_id: "", product_id: "" },
    production: { price_id: "", product_id: "" },
    studio: { price_id: "", product_id: "" },
  },
  packs: {
    500: { price_id: "" },
    2000: { price_id: "" },
    5000: { price_id: "" },
  },
};

const overrideMode = (import.meta.env.VITE_STRIPE_MODE as string | undefined)?.toLowerCase();
const useTest = overrideMode
  ? overrideMode === "test"
  : !import.meta.env.PROD;

function pick<T extends { price_id: string }>(test: T, live: T): T {
  // If TEST id is unset, fall back to LIVE so dev still works without breaking.
  return useTest && test.price_id ? test : live;
}

export const STRIPE_CONFIG: StripePriceSet = {
  plans: {
    auteur: pick(TEST.plans.auteur, LIVE.plans.auteur),
    production: pick(TEST.plans.production, LIVE.plans.production),
    studio: pick(TEST.plans.studio, LIVE.plans.studio),
  },
  packs: {
    500: pick(TEST.packs[500], LIVE.packs[500]),
    2000: pick(TEST.packs[2000], LIVE.packs[2000]),
    5000: pick(TEST.packs[5000], LIVE.packs[5000]),
  },
};

export const STRIPE_MODE: "test" | "live" =
  useTest && TEST.plans.auteur.price_id ? "test" : "live";
