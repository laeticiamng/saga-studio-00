import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COST_CONFIG = {
  base_cost: 5,
  shot_cost: 2,
  resolution_multiplier: { "720p": 1, "1080p": 1.5, "4k": 3 },
  provider_multiplier: { mock: 0, sora: 1, runway: 0.8, luma: 0.7, veo: 0.9 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { duration_sec, resolution = "1080p", provider = "sora" } = await req.json();

    const durationSec = duration_sec || 180;
    const numShots = Math.max(10, Math.ceil(durationSec / 7));
    const resMul = COST_CONFIG.resolution_multiplier[resolution as keyof typeof COST_CONFIG.resolution_multiplier] || 1;
    const provMul = COST_CONFIG.provider_multiplier[provider as keyof typeof COST_CONFIG.provider_multiplier] || 1;

    const totalCredits = Math.ceil(
      COST_CONFIG.base_cost + numShots * COST_CONFIG.shot_cost * resMul * provMul
    );

    return new Response(JSON.stringify({
      estimated_shots: numShots,
      estimated_credits: totalCredits,
      breakdown: {
        base: COST_CONFIG.base_cost,
        shots: numShots,
        per_shot: COST_CONFIG.shot_cost,
        resolution_multiplier: resMul,
        provider_multiplier: provMul,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
