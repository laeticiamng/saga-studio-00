import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey) return new Response("Missing STRIPE_SECRET_KEY", { status: 500 });

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    let event: Stripe.Event;
    const body = await req.text();

    if (webhookSecret) {
      const sig = req.headers.get("stripe-signature")!;
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } else {
      event = JSON.parse(body) as Stripe.Event;
    }

    console.log(`[STRIPE-WEBHOOK] Event: ${event.type}`);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const mode = session.metadata?.mode;

      if (!userId) {
        console.log("[STRIPE-WEBHOOK] No user_id in metadata, skipping");
        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (mode === "payment") {
        // One-time credit pack purchase — determine credits from amount
        const amountPaid = session.amount_total || 0; // in cents
        let creditsToAdd = 0;
        if (amountPaid <= 999) creditsToAdd = 50;
        else if (amountPaid <= 2499) creditsToAdd = 150;
        else creditsToAdd = 500;

        console.log(`[STRIPE-WEBHOOK] Crediting ${creditsToAdd} to user ${userId}`);

        // Update wallet
        const { data: wallet } = await supabase
          .from("credit_wallets")
          .select("balance")
          .eq("id", userId)
          .single();

        if (wallet) {
          await supabase
            .from("credit_wallets")
            .update({ balance: wallet.balance + creditsToAdd })
            .eq("id", userId);
        }

        // Ledger entry
        await supabase.from("credit_ledger").insert({
          user_id: userId,
          delta: creditsToAdd,
          reason: "stripe_purchase",
          ref_id: session.id,
          ref_type: "checkout_session",
        });
      }

      if (mode === "subscription") {
        // Subscription gives monthly credits
        const creditsToAdd = 200;
        console.log(`[STRIPE-WEBHOOK] Subscription credits ${creditsToAdd} to user ${userId}`);

        const { data: wallet } = await supabase
          .from("credit_wallets")
          .select("balance")
          .eq("id", userId)
          .single();

        if (wallet) {
          await supabase
            .from("credit_wallets")
            .update({ balance: wallet.balance + creditsToAdd })
            .eq("id", userId);
        }

        await supabase.from("credit_ledger").insert({
          user_id: userId,
          delta: creditsToAdd,
          reason: "subscription_credits",
          ref_id: session.id,
          ref_type: "checkout_session",
        });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(`[STRIPE-WEBHOOK] Error: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
