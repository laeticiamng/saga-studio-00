import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user from their JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Utilisateur non trouvé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const userId = user.id;

    // Delete user data in order (respecting FK constraints)
    // 1. Shots
    const { data: projects } = await adminClient.from("projects").select("id").eq("user_id", userId);
    const projectIds = (projects || []).map((p: { id: string }) => p.id);

    if (projectIds.length > 0) {
      await adminClient.from("shots").delete().in("project_id", projectIds);
      await adminClient.from("renders").delete().in("project_id", projectIds);
      await adminClient.from("plans").delete().in("project_id", projectIds);
      await adminClient.from("audio_analysis").delete().in("project_id", projectIds);
      await adminClient.from("asset_validations").delete().in("project_id", projectIds);
      await adminClient.from("diagnostic_events").delete().in("project_id", projectIds);
      await adminClient.from("export_versions").delete().in("project_id", projectIds);
      await adminClient.from("continuity_groups").delete().in("project_id", projectIds);
      await adminClient.from("asset_normalization_results").delete().in("project_id", projectIds);
      await adminClient.from("projects").delete().eq("user_id", userId);
    }

    // 2. Credits
    await adminClient.from("credit_ledger").delete().eq("user_id", userId);
    await adminClient.from("credit_wallets").delete().eq("id", userId);

    // 3. User roles
    await adminClient.from("user_roles").delete().eq("user_id", userId);

    // 4. Profile
    await adminClient.from("profiles").delete().eq("id", userId);

    // 5. Audit logs referencing this user
    await adminClient.from("audit_logs").delete().eq("user_id", userId);

    // 6. Delete the auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
