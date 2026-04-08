import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- Simple in-memory rate limiter ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;       // max requests
const RATE_WINDOW_MS = 60_000; // per 60 seconds

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}
// --- End rate limiter ---

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) throw new Error("Unauthorized");

    // Rate limit per user: 5 projects per minute
    if (isRateLimited(user.id)) {
      return new Response(JSON.stringify({ error: "Trop de requêtes. Réessayez dans une minute." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { type, title, mode, style_preset, duration_sec, synopsis, audio_url, aspect_ratio, face_urls, ref_photo_urls, quality_tier } = body;

    if (!type || !["clip", "film", "series", "music_video", "hybrid_video"].includes(type)) throw new Error("Invalid project type");
    if (title && typeof title === "string" && title.length > 200) throw new Error("Title too long (max 200 chars)");
    if (synopsis && typeof synopsis === "string" && synopsis.length > 10000) throw new Error("Synopsis too long (max 10000 chars)");

    // Atomic credit check & debit for project creation base cost
    const { data: debited } = await supabase.rpc("debit_credits", {
      p_user_id: user.id,
      p_amount: 5,
      p_reason: "Création de projet",
      p_ref_type: "project_creation",
    });
    if (!debited) {
      throw new Error("Crédits insuffisants (5 requis minimum)");
    }

    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        type,
        title: title || "Sans titre",
        mode: mode || "story",
        style_preset: style_preset || "cinematic",
        duration_sec: duration_sec || null,
        synopsis: synopsis || null,
        audio_url: audio_url || null,
        aspect_ratio: aspect_ratio || "16:9",
        face_urls: face_urls || [],
        ref_photo_urls: ref_photo_urls || [],
        quality_tier: quality_tier && ["premium", "standard", "economy"].includes(quality_tier) ? quality_tier : "standard",
        status: "draft",
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ project }), {
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
