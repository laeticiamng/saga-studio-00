import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- Resend email sender ---
async function sendRenderEmail(
  userEmail: string,
  projectTitle: string,
  projectId: string,
  masterUrl: string | null,
) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured, skipping email notification");
    return null;
  }

  const shareUrl = `${Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".lovable.app")}/share/${projectId}`;

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #e68a00, #cc5500); padding: 32px 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🎬 Votre rendu est prêt !</h1>
      </div>
      <div style="padding: 32px 24px;">
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Bonne nouvelle ! Le rendu de votre projet <strong>${projectTitle}</strong> est terminé.
        </p>
        ${masterUrl ? `
        <div style="text-align: center; margin: 24px 0;">
          <a href="${masterUrl}" style="display: inline-block; background: linear-gradient(135deg, #e68a00, #cc5500); color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Télécharger la vidéo
          </a>
        </div>` : ""}
        <div style="text-align: center; margin: 16px 0;">
          <a href="${shareUrl}" style="color: #e68a00; text-decoration: underline; font-size: 14px;">
            Voir et partager le projet →
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px; text-align: center;">
          CineClip AI — Génération vidéo propulsée par l'IA
        </p>
      </div>
    </div>
  `;

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CineClip AI <onboarding@resend.dev>",
        to: [userEmail],
        subject: `🎬 Rendu terminé : ${projectTitle}`,
        html,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.error("Resend error:", data);
      return { error: data };
    }
    return { success: true, id: data.id };
  } catch (err: any) {
    console.error("Resend fetch error:", err.message);
    return { error: err.message };
  }
}

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

    // --- Send email notification ---
    let emailResult = null;
    if (event === "render.completed") {
      // Get user email
      const { data: { user } } = await supabase.auth.admin.getUserById(user_id);
      if (user?.email) {
        emailResult = await sendRenderEmail(
          user.email,
          payload.project_title || "Sans titre",
          payload.project_id,
          payload.master_url_16_9 || null,
        );
      }
    }

    // --- Dispatch webhooks ---
    const { data: endpoints, error } = await supabase
      .from("webhook_endpoints")
      .select("id, url, secret, events")
      .eq("user_id", user_id)
      .eq("active", true);

    if (error) throw error;

    const results = [];

    if (endpoints && endpoints.length > 0) {
      for (const ep of endpoints) {
        if (!ep.events.includes(event)) continue;

        const bodyStr = JSON.stringify(payload);
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
            signal: AbortSignal.timeout(10_000),
          });

          const respBody = await resp.text();

          await supabase.from("webhook_deliveries").insert({
            endpoint_id: ep.id,
            event,
            payload,
            status_code: resp.status,
            response_body: respBody.slice(0, 1000),
          });

          results.push({ endpoint_id: ep.id, status: resp.status });

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
    }

    return new Response(JSON.stringify({
      dispatched: results.length,
      results,
      email: emailResult,
    }), {
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
