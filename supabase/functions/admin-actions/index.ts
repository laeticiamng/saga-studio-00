import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) throw new Error("Unauthorized");

    const { data: isAdmin } = await supabase.rpc("has_role", { _role: "admin", _user_id: user.id });
    if (!isAdmin) throw new Error("Admin access required");

    const { action, ...params } = await req.json();

    switch (action) {
      case "refund_credits": {
        const { user_id, amount, reason } = params;
        if (!user_id || !amount || amount <= 0) throw new Error("user_id and positive amount required");

        const { data: success } = await supabase.rpc("topup_credits", {
          p_user_id: user_id,
          p_amount: amount,
          p_reason: reason || `Admin refund by ${user.id}`,
          p_ref_type: "admin_refund",
        });

        if (!success) throw new Error("Refund failed");

        return new Response(JSON.stringify({ success: true, refunded: amount }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "cancel_project": {
        const { project_id } = params;
        if (!project_id) throw new Error("project_id required");

        await supabase.from("projects").update({ status: "cancelled" }).eq("id", project_id);
        await supabase.from("shots")
          .update({ status: "failed", error_message: "Cancelled by admin" })
          .eq("project_id", project_id)
          .in("status", ["pending", "generating"]);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "resolve_flag": {
        const { flag_id, resolution } = params;
        if (!flag_id) throw new Error("flag_id required");

        const { error } = await supabase.from("moderation_flags")
          .update({ status: resolution || "resolved", resolved_by: user.id })
          .eq("id", flag_id);
        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "flag_project": {
        const { project_id, reason } = params;
        if (!project_id) throw new Error("project_id required");

        await supabase.from("moderation_flags").insert({
          project_id,
          user_id: user.id,
          reason: reason || "Flagged by admin",
          status: "pending",
        });
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "stats": {
        const { data: projects } = await supabase.from("projects").select("status, type, provider_default");
        const { data: shots } = await supabase.from("shots").select("provider, status, cost_credits");
        
        const providerUsage: Record<string, number> = {};
        shots?.forEach(s => {
          if (s.provider) providerUsage[s.provider] = (providerUsage[s.provider] || 0) + 1;
        });

        return new Response(JSON.stringify({
          total_projects: projects?.length || 0,
          by_status: projects?.reduce((acc: any, p: any) => ({ ...acc, [p.status]: (acc[p.status] || 0) + 1 }), {}),
          total_shots: shots?.length || 0,
          provider_usage: providerUsage,
          total_credits_used: shots?.reduce((sum, s) => sum + (s.cost_credits || 0), 0) || 0,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
