import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { idea, type, duration_sec, style_preset } = await req.json();
    if (!idea) throw new Error("idea is required");

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const durationLabel = duration_sec ? `${Math.round(duration_sec / 60)} minute(s)` : "2 minutes";

    const prompt = `Tu es un réalisateur et scénariste de cinéma expert. À partir d'une idée brute, génère un dossier de production complet.

IDÉE DE L'UTILISATEUR : "${idea}"
TYPE : ${type === "clip" ? "Clip vidéo musical" : "Court-métrage"}
DURÉE : ${durationLabel}
STYLE VISUEL : ${style_preset || "cinématique"}

Applique la méthodologie suivante :

1. **HIGH CONCEPT** : Reformule l'idée en une logline percutante d'une phrase (format "Et si... ?")

2. **SYNOPSIS STRUCTURÉ EN 4 ACTES** adapté à la durée :
   - **ACTE 1 - HOOK** (0-${Math.round((duration_sec || 120) * 0.08)}s) : Image d'ouverture saisissante, pose l'univers
   - **ACTE 2 - CONTEXTE** (${Math.round((duration_sec || 120) * 0.08)}-${Math.round((duration_sec || 120) * 0.33)}s) : Présente le protagoniste et son monde, introduce le conflit
   - **ACTE 3 - DÉVELOPPEMENT** (${Math.round((duration_sec || 120) * 0.33)}-${Math.round((duration_sec || 120) * 0.83)}s) : Escalade des enjeux, obstacles, transformation
   - **ACTE 4 - CLIMAX** (${Math.round((duration_sec || 120) * 0.83)}-${duration_sec || 120}s) : Résolution émotionnelle, image finale mémorable

3. **PERSONNAGES** (les 3 piliers pour chacun) :
   - **Want** (désir conscient) : Ce que le personnage croit vouloir
   - **Need** (besoin inconscient) : Ce dont il a vraiment besoin
   - **Flaw** (défaut fatal) : Ce qui l'empêche d'obtenir ce qu'il veut
   - Description physique détaillée pour la génération vidéo IA

4. **AMBIANCE VISUELLE** :
   - Palette de couleurs (3-5 couleurs dominantes)
   - Style d'éclairage (golden hour, néon, clair-obscur, etc.)
   - Mood / atmosphère
   - Références cinématographiques (2-3 films)

Utilise les outils fournis pour structurer ta réponse.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        tools: [{
          type: "function",
          function: {
            name: "production_plan",
            description: "Return a structured production plan",
            parameters: {
              type: "object",
              properties: {
                logline: { type: "string", description: "High concept logline in one sentence" },
                synopsis: { type: "string", description: "Full synopsis structured in 4 acts, written as flowing prose (5-8 lines)" },
                characters: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      role: { type: "string", enum: ["protagonist", "antagonist", "supporting"] },
                      want: { type: "string" },
                      need: { type: "string" },
                      flaw: { type: "string" },
                      visual_description: { type: "string", description: "Detailed physical description for AI video generation" },
                    },
                    required: ["name", "role", "want", "need", "flaw", "visual_description"],
                    additionalProperties: false,
                  },
                },
                ambiance: {
                  type: "object",
                  properties: {
                    palette: { type: "array", items: { type: "string" }, description: "3-5 dominant colors" },
                    lighting: { type: "string" },
                    mood: { type: "string" },
                    references: { type: "array", items: { type: "string" }, description: "2-3 film references" },
                  },
                  required: ["palette", "lighting", "mood", "references"],
                  additionalProperties: false,
                },
              },
              required: ["logline", "synopsis", "characters", "ambiance"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "production_plan" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No structured response from AI");

    const plan = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, ...plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("enhance-synopsis error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
