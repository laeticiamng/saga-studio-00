import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { user_id, payload } = await req.json();
    if (!user_id || !payload) throw new Error("Missing user_id or payload");

    const event = payload.event || "render.completed";

    // Fetch active webhook endpoints for this user that subscribe to this event
    const { data: endpoints, error } = await supabase
      .from("webhook_endpoints")
      .select("id, url, secret, events")
      .eq("user_id", user_id)
      .eq("active", true);

    if (error) throw error;
    if (!endpoints || endpoints.length === 0) {
      return new Response(JSON.stringify({ dispatched: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const ep of endpoints) {
      // Check if this endpoint subscribes to the event
      if (!ep.events.includes(event)) continue;

      const bodyStr = JSON.stringify(payload);

      // Generate HMAC signature using the endpoint's secret
      const hmac = createHmac("sha256", ep.secret);
      hmac.update(bodyStr);
      const signature = hmac.digest("hex");

      try {
        const resp = await fetch(ep.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Signature": signature,
            "X-Webhook-Event": event,
          },
          body: bodyStr,
          signal: AbortSignal.timeout(10_000), // 10s timeout
        });

        const respBody = await resp.text();

        // Log the delivery
        await supabase.from("webhook_deliveries").insert({
          endpoint_id: ep.id,
          event,
          payload,
          status_code: resp.status,
          response_body: respBody.slice(0, 1000),
        });

        results.push({ endpoint_id: ep.id, status: resp.status });

        // Disable endpoint after 5 consecutive failures
        if (resp.status >= 400) {
          const { data: recentDeliveries } = await supabase
            .from("webhook_deliveries")
            .select("status_code")
            .eq("endpoint_id", ep.id)
            .order("created_at", { ascending: false })
            .limit(5);

          if (recentDeliveries && recentDeliveries.length >= 5 &&
              recentDeliveries.every(d => (d.status_code || 0) >= 400)) {
            await supabase
              .from("webhook_endpoints")
              .update({ active: false })
              .eq("id", ep.id);
          }
        }
      } catch (fetchErr: any) {
        // Log failed delivery
        await supabase.from("webhook_deliveries").insert({
          endpoint_id: ep.id,
          event,
          payload,
          status_code: 0,
          response_body: fetchErr.message?.slice(0, 1000) || "Unknown error",
        });
        results.push({ endpoint_id: ep.id, status: 0, error: fetchErr.message });
      }
    }

    return new Response(JSON.stringify({ dispatched: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("dispatch-webhooks error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
