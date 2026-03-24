import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all providers
    const { data: providers, error } = await supabase
      .from("provider_registry")
      .select("*");
    if (error) throw error;

    const results = [];
    const now = new Date().toISOString();

    for (const provider of providers || []) {
      let status = "unknown";
      let detail = "";

      try {
        switch (provider.name) {
          case "openai_image": {
            const key = Deno.env.get("OPENAI_API_KEY");
            status = key ? "ok" : "missing_key";
            detail = key ? "API key configured" : "OPENAI_API_KEY not set";
            break;
          }
          case "runway": {
            const key = Deno.env.get("RUNWAY_API_KEY");
            status = key ? "ok" : "missing_key";
            detail = key ? "API key configured" : "RUNWAY_API_KEY not set";
            break;
          }
          case "luma": {
            const key = Deno.env.get("LUMA_API_KEY");
            status = key ? "ok" : "missing_key";
            detail = key ? "API key configured" : "LUMA_API_KEY not set";
            break;
          }
          case "mock":
            status = "ok";
            detail = "Development mock provider";
            break;
          default:
            status = "unknown";
            detail = "Unknown provider";
        }
      } catch (err: unknown) {
        status = "error";
        detail = err instanceof Error ? err.message : "Health check failed";
      }

      // Update provider health
      await supabase
        .from("provider_registry")
        .update({
          health_status: status,
          health_checked_at: now,
        })
        .eq("id", provider.id);

      results.push({
        name: provider.name,
        display_name: provider.display_name,
        status,
        detail,
        is_enabled: provider.is_enabled,
      });
    }

    return new Response(JSON.stringify({ providers: results, checked_at: now }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
