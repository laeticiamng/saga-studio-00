import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Cinematic Formula: 5 Pillars ──────────────────────────────────────────
// [Sujet Détaillé] + [Style Artistique] + [Cadrage & Composition] + [Lumière & Ambiance] + [Détails & Textures]

const CAMERA_MOVEMENTS: Record<string, string[]> = {
  wide: ["slow dolly out", "crane shot ascending", "establishing pan left to right", "static wide angle"],
  medium: ["smooth tracking shot", "steady dolly forward", "slow orbit around subject", "handheld follow"],
  close: ["static close-up", "slow push in", "rack focus to subject", "intimate handheld"],
  detail: ["macro lens extreme close-up", "slow tilt reveal", "focus pull between details", "static insert shot"],
};

const ENERGY_CAMERA_MAP: Record<string, string> = {
  high: "dynamic fast-paced cuts, whip pans, rapid dolly movements, handheld energy",
  medium: "smooth tracking shots, moderate pacing, balanced compositions",
  low: "slow contemplative movements, static wide shots, long takes, gentle drifts",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) throw new Error("Unauthorized");

    // Rate limit — 15/min/user (planning is AI-heavy)
    const rl = await checkRateLimit(supabase, user.id, {
      endpoint: "plan-project", cost: 1, capacity: 15, refillPerMinute: 15,
    });
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    const { project_id } = await req.json();
    if (!project_id) throw new Error("project_id required");

    // Verify ownership
    const { data: project } = await supabase.from("projects").select("*").eq("id", project_id).single();
    if (!project) throw new Error("Project not found");
    if (project.user_id !== user.id) {
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) throw new Error("Forbidden: not your project");
    }

    const { data: analysis } = await supabase.from("audio_analysis").select("*").eq("project_id", project_id).maybeSingle();

    // ── Load corpus context: canonical fields + extracted entities ──
    let corpusSection = "";
    const { data: canonicalFields } = await supabase
      .from("canonical_fields")
      .select("entity_type, field_key, canonical_value, confidence, entity_name")
      .eq("project_id", project_id)
      .gte("confidence", 0.5)
      .order("confidence", { ascending: false })
      .limit(200);

    const { data: docs } = await supabase
      .from("source_documents")
      .select("id, document_role, source_priority")
      .eq("project_id", project_id)
      .neq("status", "parsing_failed");
    const docIds = (docs || []).map((d: any) => d.id);

    if (canonicalFields?.length || docIds.length > 0) {
      const canonParts: string[] = [];
      if (canonicalFields?.length) {
        const grouped: Record<string, Record<string, unknown>> = {};
        for (const f of canonicalFields) {
          const key = f.entity_name || f.entity_type;
          if (!grouped[key]) grouped[key] = {};
          grouped[key][f.field_key] = f.canonical_value;
        }
        canonParts.push("### Données canoniques du corpus\n" + JSON.stringify(grouped, null, 1));
      }

      if (docIds.length > 0) {
        const { data: entities } = await supabase
          .from("source_document_entities")
          .select("entity_type, entity_key, entity_value, extraction_confidence")
          .in("document_id", docIds)
          .in("entity_type", ["character", "location", "scene", "mood", "camera_direction", "lighting", "color_palette", "sound_design", "visual_reference", "cinematic_reference", "production_directive", "sensory_note"])
          .gte("extraction_confidence", 0.6)
          .in("status", ["confirmed", "proposed"])
          .order("extraction_confidence", { ascending: false })
          .limit(100);
        if (entities?.length) {
          const byType: Record<string, unknown[]> = {};
          for (const e of entities) {
            if (!byType[e.entity_type]) byType[e.entity_type] = [];
            byType[e.entity_type].push({ key: e.entity_key, ...e.entity_value as Record<string, unknown> });
          }
          canonParts.push("### Entités extraites du corpus\n" + JSON.stringify(byType, null, 1));
        }
      }

      if (canonParts.length > 0) {
        corpusSection = `\n\n## CONTEXTE CORPUS (données extraites des documents source — UTILISE-LES pour enrichir les plans)\n${canonParts.join("\n\n")}`;
      }
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const sections = analysis?.sections_json || [];
    const energyData = analysis?.energy_json || [];
    const durationSec = project.duration_sec || 180;
    const numShots = Math.max(10, Math.ceil(durationSec / 7));

    const prompt = `Tu es un réalisateur IA d'élite appliquant la **Formule Cinématographique des 5 Piliers** pour créer un plan de production.
IMPORTANT : Tout le contenu généré (prompts, descriptions, bible de style, personnages) doit être rédigé EN FRANÇAIS.
Les prompts de chaque plan (shot) doivent cependant contenir des termes techniques cinématographiques en anglais entre crochets pour la compatibilité avec les modèles de génération vidéo (ex: [FRAMING] plan large, dolly out).

## FORMULE DES 5 PILIERS
Chaque prompt de plan DOIT suivre cette structure :
1. **[SUBJECT & ACTION]** — Description détaillée de qui/quoi et de ce qui se passe
2. **[ARTISTIC STYLE]** — Style visuel, mouvement artistique, qualité des textures
3. **[FRAMING & COMPOSITION]** — Angle de caméra (contre-plongée, plongée, dutch angle), type de plan (large/moyen/rapproché/détail), règle des tiers, lignes de fuite
4. **[LIGHTING & ATMOSPHERE]** — Source lumineuse, qualité (dure/douce), température de couleur, ombres, moment de la journée
5. **[DETAILS & TEXTURES]** — Micro-détails, matières, particules, éléments environnementaux

## DÉTAILS DU PROJET
- Titre : ${project.title}
- Type : ${project.type === "clip" ? "Clip vidéo musical" : "Court-métrage"}
- Mode : ${project.mode || "story"} (story = arc narratif, performance = performance live, abstract = art visuel)
- Style visuel : ${project.style_preset || "cinematic"}
- Durée : ${durationSec} secondes
- Synopsis : ${project.synopsis || "Aucun synopsis fourni"}
${corpusSection}
- BPM audio : ${analysis?.bpm || 120}
- Sections audio : ${JSON.stringify(sections)}
- Courbe d'énergie : ${JSON.stringify(energyData)}
- Nombre de plans nécessaires : ${numShots}

## RÈGLES DE LA BIBLE DES PERSONNAGES
Pour chaque personnage, définis les 3 piliers narratifs :
- **Want** (désir conscient) : Ce que le personnage croit vouloir
- **Need** (besoin inconscient) : Ce dont il a vraiment besoin pour évoluer
- **Flaw** (défaut fatal) : Ce qui l'empêche d'obtenir ce qu'il veut
- **Description visuelle** : Description physique extrêmement détaillée pour une génération IA cohérente à travers tous les plans

## DIRECTIVES DE MOUVEMENT DE CAMÉRA
- Plans d'ouverture (premiers 15%) : Plans d'établissement — dolly lent, grue, ou plan large statique
- Sections haute énergie (refrain) : Travelling dynamique, panoramiques rapides, coupes rapides, caméra épaule
- Sections basse énergie (couplet/intro) : Mouvements lents, plans larges contemplatifs, plans-séquences
- Moments émotionnels : Gros plans avec push-in lent ou cadrage intime statique
- Climax (derniers 15%) : Mouvements de caméra les plus dynamiques, angles dramatiques

## EXIGENCES DE LA BIBLE DE STYLE
Inclure :
- regles_visuelles : Description complète du langage visuel
- palette : Tableau de 5 couleurs spécifiques (hex ou descriptif)
- regles_camera : Comportement par défaut de la caméra et motifs de mouvement
- eclairage : Configuration détaillée de l'éclairage (principal, d'appoint, contour, lumières d'ambiance)
- ambiance : Ton émotionnel et atmosphère
- directives_texture : Grain de film, effets de lentille, look de post-production

Génère une réponse JSON avec cette structure exacte :
{
  "style_bible": {
    "regles_visuelles": "description complète du style visuel appliquant les 5 piliers",
    "palette": ["couleur1", "couleur2", "couleur3", "couleur4", "couleur5"],
    "regles_camera": "directives détaillées de mouvement et cadrage de caméra",
    "eclairage": "style d'éclairage détaillé avec descriptions principal/d'appoint/contour",
    "ambiance": "ton émotionnel et atmosphère",
    "directives_texture": "grain de film, effets de lentille, post-production"
  },
  "character_bible": [
    {
      "name": "Nom du personnage",
      "description": "Description visuelle extrêmement détaillée pour la génération IA cohérente",
      "role": "protagoniste/antagoniste/secondaire",
      "want": "désir conscient",
      "need": "besoin inconscient",
      "flaw": "défaut fatal"
    }
  ],
  "shotlist": [
    {
      "idx": 0,
      "start_sec": 0,
      "end_sec": 7,
      "duration_sec": 7,
      "shot_type": "wide/medium/close/detail",
      "camera_movement": "mouvement de caméra spécifique pour ce plan",
      "prompt": "[SUBJECT & ACTION] action détaillée en français. [STYLE] esthétique ${project.style_preset}. [FRAMING] angle et composition spécifiques. [LIGHTING] configuration d'éclairage spécifique. [DETAILS] textures, particules, détails environnementaux.",
      "negative_prompt": "flou, basse qualité, déformé, filigrane, texte incrusté, style incohérent, générique, aspect vidéo stock",
      "section": "intro/couplet/refrain/pont/outro",
      "energy_level": "low/medium/high"
    }
  ]
}

RÈGLES CRITIQUES :
- Fais exactement ${numShots} plans couvrant les ${durationSec} secondes complètes
- Chaque plan entre 5 et 10 secondes
- CHAQUE prompt doit explicitement inclure les 5 piliers
- Adapte l'énergie : les sections haute énergie ont des plans dynamiques/rapides, basse énergie des plans plus lents/larges
- Les descriptions de personnages doivent être réutilisées mot pour mot entre les plans pour la cohérence
- Les prompts négatifs doivent être spécifiques et pertinents
- Réponds UNIQUEMENT avec du JSON valide`;
    let plan: any;
    try {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 8000,
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          plan = JSON.parse(jsonMatch[0]);
          if (!plan.shotlist?.length || plan.shotlist.length < 3) {
            console.warn("AI plan had too few shots, falling back");
            plan = null;
          }
        }
      } else {
        const errText = await aiResponse.text();
        console.warn("AI gateway error:", aiResponse.status, errText);
      }
    } catch (aiErr: unknown) {
      console.warn("AI call failed, using fallback plan:", aiErr instanceof Error ? aiErr.message : aiErr);
    }

    // Fallback plan with 5 pillars applied
    if (!plan) {
      const shotDuration = durationSec / numShots;
      const shotTypes = ["wide", "medium", "close", "detail"];
      const sectionsList = sections as any[];

      plan = {
        style_bible: {
          regles_visuelles: `Style ${project.style_preset} avec un langage visuel cohérent. Application des 5 piliers : sujets détaillés, direction artistique forte, cadrage intentionnel, éclairage motivé, textures riches.`,
          palette: ["bleu nuit profond", "ambre doré chaud", "ivoire doux", "charbon mat", "accent cramoisi"],
          regles_camera: "Mouvements de dolly fluides pour les plans larges, caméra épaule intime pour les gros plans, travelling dynamique pour les séquences d'action. Toujours un mouvement de caméra motivé.",
          eclairage: "Éclairage cinématique trois points : lumière principale chaude à 45°, lumière d'appoint froide du côté opposé, contour pour la séparation des plans. Lumières d'ambiance pour l'atmosphère.",
          ambiance: project.mode === "abstract" ? "éthéré, surréaliste, hypnotique" : "captivant, émotionnel, immersif",
          directives_texture: "Grain de film subtil, léger vignettage de lentille, étalonnage organique avec noirs relevés. Éviter la netteté numérique.",
        },
        character_bible: project.mode === "abstract" ? [] : [
          {
            name: "Personnage principal",
            description: `Une figure captivante dans le style visuel ${project.style_preset}. Carrure moyenne, regard expressif, silhouette distinctive. Garde-robe cohérente : vêtements sombres superposés avec une pièce de couleur d'accent. Visible dans tous les plans narratifs.`,
            role: "protagoniste",
            want: "Trouver une connexion dans un monde déconnecté",
            need: "Accepter la vulnérabilité comme une force",
            flaw: "Des murs émotionnels construits par les blessures passées",
          },
        ],
        shotlist: Array.from({ length: numShots }, (_, i) => {
          const startSec = Math.round(i * shotDuration * 10) / 10;
          const endSec = Math.round((i + 1) * shotDuration * 10) / 10;
          const sectionIdx = Math.min(
            Math.floor(i / Math.max(1, numShots / Math.max(1, sectionsList.length))),
            sectionsList.length - 1
          );
          const section = sectionsList[sectionIdx]?.type || "couplet";
          const isHighEnergy = section.includes("chorus") || section.includes("refrain");
          const shotType = shotTypes[i % 4];
          const cameraOptions = CAMERA_MOVEMENTS[shotType];
          const cameraMove = cameraOptions[i % cameraOptions.length];
          const energyLevel = isHighEnergy ? "high" : (section.includes("bridge") || section.includes("pont") ? "medium" : "low");

          return {
            idx: i,
            start_sec: startSec,
            end_sec: endSec,
            duration_sec: Math.round(shotDuration * 10) / 10,
            shot_type: shotType,
            camera_movement: cameraMove,
            prompt: `[SUBJECT] ${isHighEnergy ? "Séquence d'action dynamique" : "Moment contemplatif"}, plan ${i + 1} sur ${numShots}. [STYLE] Esthétique ${project.style_preset}, langage visuel cohérent. [FRAMING] Plan ${shotType === "wide" ? "large" : shotType === "medium" ? "moyen" : shotType === "close" ? "rapproché" : "détail"}, ${cameraMove}. [LIGHTING] ${isHighEnergy ? "Éclairage dramatique à fort contraste avec ombres marquées" : "Éclairage doux et diffus avec dégradés subtils"}. [DETAILS] Textures riches, particules atmosphériques, énergie de section ${section}.`,
            negative_prompt: "flou, basse qualité, déformé, filigrane, texte incrusté, style incohérent, aspect vidéo stock générique, artefacts IA",
            section,
            energy_level: energyLevel,
          };
        }),
      };
    }

    // Store plan
    await supabase.from("plans").insert({
      project_id,
      style_bible_json: plan.style_bible,
      character_bible_json: plan.character_bible,
      shotlist_json: plan.shotlist,
      version: 1,
    });

    // Create shot records
    const shotsToInsert = plan.shotlist.map((s: any) => ({
      project_id,
      idx: s.idx,
      prompt: s.prompt,
      negative_prompt: s.negative_prompt || null,
      duration_sec: s.duration_sec,
      status: "pending",
    }));

    await supabase.from("shots").insert(shotsToInsert);

    // Advance to generating
    await supabase.from("projects").update({ status: "generating" }).eq("id", project_id);

    return new Response(JSON.stringify({
      success: true,
      shots_created: plan.shotlist.length,
      has_ai_plan: !!plan.style_bible?.visual_rules,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("Plan error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
