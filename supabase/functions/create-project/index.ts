import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const { type, title, mode, style_preset, duration_sec, synopsis, audio_url } = body;

    if (!type || !["clip", "film"].includes(type)) throw new Error("Invalid project type");

    // Atomic credit check & debit for project creation base cost
    const { data: debited } = await supabase.rpc("debit_credits", {
      p_user_id: user.id,
      p_amount: 5,
      p_reason: "Project creation",
      p_ref_type: "project_creation",
    });
    if (!debited) {
      throw new Error("Insufficient credits (need at least 5)");
    }

    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        type,
        title: title || "Untitled",
        mode: mode || "story",
        style_preset: style_preset || "cinematic",
        duration_sec: duration_sec || null,
        synopsis: synopsis || null,
        audio_url: audio_url || null,
        status: "draft",
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ project }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
