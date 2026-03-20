import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: any) => {
  console.log(`[STRIPE-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

// Credit pack tiers by price_id (must match STRIPE_CONFIG in Pricing.tsx)
const CREDIT_PACKS_BY_CENTS: { maxCents: number; credits: number }[] = [
  { maxCents: 500, credits: 50 },    // 5€ = 50 credits
  { maxCents: 1500, credits: 200 },   // 15€ = 200 credits
  { maxCents: 3000, credits: 500 },   // 30€ = 500 credits
  { maxCents: Infinity, credits: 500 },
];

function creditsForAmount(cents: number): number {
  return CREDIT_PACKS_BY_CENTS.find(p => cents <= p.maxCents)?.credits || 50;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!stripeKey || !webhookSecret) {
    log("ERROR", { missing: !stripeKey ? "STRIPE_SECRET_KEY" : "STRIPE_WEBHOOK_SECRET" });
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // ── Mandatory signature verification ──
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      log("REJECTED: Missing stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err: unknown) {
      log("REJECTED: Invalid signature", { error: err instanceof Error ? err.message : "Unknown" });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log(`Event received: ${event.type}`, { id: event.id });

    // ── Handle checkout.session.completed (one-time purchase + first subscription) ──
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const mode = session.metadata?.mode;

      if (!userId) {
        log("Skipping: no user_id in metadata", { sessionId: session.id });
        return ok();
      }

      if (mode === "payment") {
        const credits = creditsForAmount(session.amount_total || 0);
        log(`One-time purchase`, { userId, cents: session.amount_total, credits });

        const { data: success } = await supabase.rpc("topup_credits", {
          p_user_id: userId,
          p_amount: credits,
          p_reason: `stripe_purchase_${session.amount_total}c`,
          p_ref_id: session.id,
          p_ref_type: "checkout_session",
        });

        if (!success) log("Idempotent skip: already processed", { sessionId: session.id });
        else log("Credits added", { userId, credits });
      }

      if (mode === "subscription") {
        // Pro = 100 credits, Studio = 500 credits — determine from amount
        const amount = session.amount_total || 0;
        const credits = amount <= 2000 ? 100 : 500; // Pro ≤ 20€, Studio > 20€
        log(`New subscription`, { userId, credits, amount });

        const { data: success } = await supabase.rpc("topup_credits", {
          p_user_id: userId,
          p_amount: credits,
          p_reason: "subscription_initial",
          p_ref_id: session.id,
          p_ref_type: "checkout_session",
        });

        if (!success) log("Idempotent skip: already processed");
        else log("Subscription credits added", { userId, credits });
      }
    }

    // ── Handle invoice.payment_succeeded (subscription renewals) ──
    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;

      // Skip the first invoice (already handled by checkout.session.completed)
      if (invoice.billing_reason === "subscription_create") {
        log("Skipping initial invoice (handled by checkout)");
        return ok();
      }

      // Find user by customer email
      const customerEmail = typeof invoice.customer_email === "string"
        ? invoice.customer_email
        : null;

      if (!customerEmail) {
        // Try to get email from customer object
        const customer = await stripe.customers.retrieve(invoice.customer as string);
        if (!customer || (customer as any).deleted) {
          log("Cannot find customer for invoice", { invoiceId: invoice.id });
          return ok();
        }
      }

      const email = customerEmail || (await stripe.customers.retrieve(invoice.customer as string) as Stripe.Customer).email;
      if (!email) { log("No email for customer"); return ok(); }

      // Look up user by email in auth
      const { data: users } = await supabase.auth.admin.listUsers();
      const user = users?.users?.find(u => u.email === email);

      if (!user) {
        log("No matching user for email", { email });
        return ok();
      }

      // Determine credits based on invoice amount
      const invoiceAmount = invoice.amount_paid || 0;
      const credits = invoiceAmount <= 2000 ? 100 : 500;
      log(`Subscription renewal`, { userId: user.id, invoiceId: invoice.id, credits, invoiceAmount });

      const { data: success } = await supabase.rpc("topup_credits", {
        p_user_id: user.id,
        p_amount: credits,
        p_reason: `subscription_renewal_${invoice.billing_reason}`,
        p_ref_id: invoice.id,
        p_ref_type: "invoice",
      });

      if (!success) log("Idempotent skip: invoice already processed");
      else log("Renewal credits added", { userId: user.id, credits });
    }

    // ── Handle customer.subscription.deleted (cancellation) ──
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      log("Subscription cancelled", { subscriptionId: subscription.id, customerId: subscription.customer });
      // No credits to remove — user keeps what they have until next cycle
    }

    return ok();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const stack = err instanceof Error ? err.stack?.slice(0, 200) : undefined;
    log("ERROR", { message, stack });
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function ok() {
  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
