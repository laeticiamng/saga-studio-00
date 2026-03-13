import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth: verify JWT and get user ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { project_id, idea, type, duration_sec, style_preset } = body;

    // ── Mode 1: Enhance existing project synopsis ──
    if (project_id) {
      const { data: project, error: projErr } = await supabase
        .from("projects").select("id, user_id, synopsis, title, type, style_preset, duration_sec")
        .eq("id", project_id).single();

      if (projErr || !project) throw new Error("Project not found");
      if (project.user_id !== user.id) {
        return new Response(JSON.stringify({ error: "Forbidden: you are not the owner of this project" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!project.synopsis || project.synopsis.length < 3) {
        throw new Error("No synopsis to enhance");
      }

      console.log(`[enhance-synopsis] Enhancing project ${project_id} for user ${user.id}`);

      const apiKey = Deno.env.get("LOVABLE_API_KEY");
      if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

      const durationLabel = project.duration_sec ? `${Math.round(project.duration_sec / 60)} minute(s)` : "2 minutes";
      const styleLabel = project.style_preset || "cinématique";

      const prompt = `Tu es un script-doctor de cinéma expert. On te donne un synopsis brut et tu dois l'enrichir en conservant l'idée originale.

SYNOPSIS ORIGINAL :
"""
${project.synopsis}
"""

TITRE : ${project.title}
TYPE : ${project.type === "clip" ? "Clip vidéo musical" : "Court-métrage"}
DURÉE : ${durationLabel}
STYLE : ${styleLabel}

CONSIGNES D'ENRICHISSEMENT :
1. **Tonalité** : Renforce le ton émotionnel (tension, mélancolie, euphorie, mystère…)
2. **Structure** : Assure une progression en 4 temps (Hook → Contexte → Développement → Climax)
3. **Clarté visuelle** : Ajoute des détails visuels concrets exploitables par un générateur vidéo IA
4. **Mots-clés cinématographiques** : Intègre des termes de mise en scène (travelling, gros plan, contre-plongée…)
5. **Cohérence** : Vérifie que le synopsis est cohérent et fluide

IMPORTANT : Garde l'essence et l'histoire originale. Ne change pas radicalement le sujet. Enrichis, ne réécris pas.

Utilise l'outil fourni pour retourner le résultat structuré.`;

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
              name: "enhanced_synopsis",
              description: "Return the enhanced synopsis",
              parameters: {
                type: "object",
                properties: {
                  synopsis: { type: "string", description: "The enhanced synopsis (5-10 lines of flowing prose)" },
                  changes_summary: { type: "string", description: "Brief summary of what was improved (1-2 sentences)" },
                  tone: { type: "string", description: "Identified/reinforced tone (e.g. mélancolique, épique, onirique)" },
                  structure_notes: { type: "string", description: "Notes on the 4-act structure applied" },
                },
                required: ["synopsis", "changes_summary", "tone", "structure_notes"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "enhanced_synopsis" } },
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

      const result = JSON.parse(toolCall.function.arguments);

      // ── Persist enhanced synopsis ──
      const { error: updateErr } = await supabase
        .from("projects")
        .update({ synopsis: result.synopsis })
        .eq("id", project_id);

      if (updateErr) {
        console.error("Failed to persist synopsis:", updateErr.message);
        throw new Error("Failed to save enhanced synopsis");
      }

      console.log(`[enhance-synopsis] Successfully enhanced and saved for project ${project_id}`);

      return new Response(JSON.stringify({
        success: true,
        synopsis: result.synopsis,
        changes_summary: result.changes_summary,
        tone: result.tone,
        structure_notes: result.structure_notes,
        persisted: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Mode 2: Generate from idea (existing behavior for CreateFilm) ──
    if (!idea) throw new Error("idea or project_id is required");

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const durationLabel = duration_sec ? `${Math.round(duration_sec / 60)} minute(s)` : "2 minutes";
    const effectiveDuration = duration_sec || 120;

    const prompt = `Tu es un réalisateur et scénariste de cinéma expert. À partir d'une idée brute, génère un dossier de production complet.

IDÉE DE L'UTILISATEUR : "${idea}"
TYPE : ${type === "clip" ? "Clip vidéo musical" : "Court-métrage"}
DURÉE : ${durationLabel}
STYLE VISUEL : ${style_preset || "cinématique"}

Applique la méthodologie suivante :

1. **HIGH CONCEPT** : Reformule l'idée en une logline percutante d'une phrase (format "Et si... ?")

2. **SYNOPSIS STRUCTURÉ EN 4 ACTES** adapté à la durée :
   - **ACTE 1 - HOOK** (0-${Math.round(effectiveDuration * 0.08)}s) : Image d'ouverture saisissante, pose l'univers
   - **ACTE 2 - CONTEXTE** (${Math.round(effectiveDuration * 0.08)}-${Math.round(effectiveDuration * 0.33)}s) : Présente le protagoniste et son monde, introduce le conflit
   - **ACTE 3 - DÉVELOPPEMENT** (${Math.round(effectiveDuration * 0.33)}-${Math.round(effectiveDuration * 0.83)}s) : Escalade des enjeux, obstacles, transformation
   - **ACTE 4 - CLIMAX** (${Math.round(effectiveDuration * 0.83)}-${effectiveDuration}s) : Résolution émotionnelle, image finale mémorable

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
