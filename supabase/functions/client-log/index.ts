import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Extract user from JWT if present
    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
      );
      const { data: { user } } = await anonClient.auth.getUser(token);
      userId = user?.id ?? null;
    }

    const body = await req.json();
    const { level, tag, message, details } = body;

    if (!level || !tag || !message) {
      return new Response(
        JSON.stringify({ error: "level, tag, and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Only persist error and warn levels
    if (level !== "error" && level !== "warn") {
      return new Response(
        JSON.stringify({ ok: true, persisted: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: `client_${level}`,
      entity_type: "client_log",
      entity_id: tag,
      details: {
        message: typeof message === "string" ? message : JSON.stringify(message),
        ...(details ? { extra: details } : {}),
        user_agent: req.headers.get("user-agent") || undefined,
      },
    });

    return new Response(
      JSON.stringify({ ok: true, persisted: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("client-log error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
