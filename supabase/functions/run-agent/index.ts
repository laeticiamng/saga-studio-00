import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Episode status transitions after all agents for a step complete
const STATUS_TRANSITIONS: Record<string, string> = {
  story_development: "psychology_review",
  psychology_review: "legal_ethics_review",
  legal_ethics_review: "visual_bible",
  visual_bible: "continuity_check",
  continuity_check: "shot_generation",
  shot_generation: "shot_review",
  shot_review: "assembly",
  assembly: "edit_review",
  edit_review: "delivery",
  delivery: "completed",
};

// Steps that require approval before advancing
const APPROVAL_REQUIRED_STEPS = new Set([
  "psychology_review", "legal_ethics_review", "continuity_check",
  "shot_review", "edit_review",
]);

// Confidence thresholds for auto-approval
const AUTO_APPROVE_THRESHOLDS: Record<string, number> = {
  psychology_review: 0.85,
  legal_ethics_review: 0.90,
  continuity_check: 0.90,
  shot_review: 0.80,
  edit_review: 0.85,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { agent_run_id, correlation_id } = body;
    if (!agent_run_id) throw new Error("agent_run_id required");

    // Fetch the run
    const { data: run, error: runErr } = await supabase
      .from("agent_runs")
      .select("*")
      .eq("id", agent_run_id)
      .single();
    if (runErr || !run) throw new Error("Agent run not found");

    // Idempotency: if already completed or running, skip
    if (run.status === "completed") {
      return new Response(JSON.stringify({
        run_id: run.id,
        status: "completed",
        message: "Already completed (idempotent)",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (run.status === "running") {
      return new Response(JSON.stringify({
        run_id: run.id,
        status: "running",
        message: "Already running",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Mark as running
    const startedAt = new Date().toISOString();
    await supabase
      .from("agent_runs")
      .update({ status: "running", started_at: startedAt, correlation_id: correlation_id || run.correlation_id })
      .eq("id", run.id);

    // Fetch the active prompt for this agent
    const { data: prompt } = await supabase
      .from("agent_prompts")
      .select("*")
      .eq("agent_slug", run.agent_slug)
      .eq("is_active", true)
      .single();

    // Fetch episode context if available
    let episodeContext: Record<string, unknown> = {};
    if (run.episode_id) {
      const { data: episode } = await supabase
        .from("episodes")
        .select("*, season:seasons!episodes_season_id_fkey(id, series_id, number, title)")
        .eq("id", run.episode_id)
        .single();
      if (episode) episodeContext = { episode };

      // Fetch continuity memory for context
      if (run.series_id) {
        const { data: memoryNodes } = await supabase
          .from("continuity_memory_nodes")
          .select("*")
          .eq("series_id", run.series_id)
          .eq("is_active", true)
          .limit(50);
        if (memoryNodes?.length) {
          episodeContext.continuity_memory = memoryNodes;
        }

        // Fetch character profiles for context
        const { data: characters } = await supabase
          .from("character_profiles")
          .select("name, visual_description, personality, relationships, wardrobe, voice_notes")
          .eq("series_id", run.series_id);
        if (characters?.length) {
          episodeContext.characters = characters;
        }

        // Fetch bibles for context
        const { data: bibles } = await supabase
          .from("bibles")
          .select("type, name, content")
          .eq("series_id", run.series_id);
        if (bibles?.length) {
          episodeContext.bibles = bibles;
        }
      }
    }

    // ── Corpus context injection: canonical fields + extracted entities ──
    // Resolve project_id from series → project chain
    let corpusProjectId: string | null = null;
    if (run.series_id) {
      const { data: series } = await supabase
        .from("series")
        .select("project_id")
        .eq("id", run.series_id)
        .single();
      corpusProjectId = series?.project_id || null;
    }

    if (corpusProjectId) {
      // Load canonical fields (governance-approved data)
      const { data: canonicalFields } = await supabase
        .from("canonical_fields")
        .select("entity_type, field_key, canonical_value, confidence, entity_name")
        .eq("project_id", corpusProjectId)
        .gte("confidence", 0.5)
        .order("confidence", { ascending: false })
        .limit(200);
      if (canonicalFields?.length) {
        const canon: Record<string, Record<string, unknown>> = {};
        for (const f of canonicalFields) {
          const key = f.entity_name || f.entity_type;
          if (!canon[key]) canon[key] = {};
          canon[key][f.field_key] = f.canonical_value;
        }
        episodeContext.corpus_canon = canon;
      }

      // Load key extracted entities for rich context
      const { data: docs } = await supabase
        .from("source_documents")
        .select("id, document_role, source_priority")
        .eq("project_id", corpusProjectId)
        .neq("status", "parsing_failed");
      const docIds = (docs || []).map((d: any) => d.id);

      if (docIds.length > 0) {
        // Determine which entity types to load based on agent
        const agentEntityMap: Record<string, string[]> = {
          story_architect: ["character", "location", "episode", "synopsis", "logline", "theme", "relationship", "character_arc", "chronology"],
          scriptwriter: ["character", "location", "scene", "dialogue_sample", "mood", "prop", "continuity_rule", "emotional_arc"],
          visual_director: ["visual_reference", "cinematic_reference", "color_palette", "lighting", "camera_direction", "mood", "ambiance", "sensory_note"],
          scene_designer: ["scene", "location", "prop", "mood", "lighting", "color_palette", "camera_direction", "sensory_note", "production_directive"],
          shot_planner: ["scene", "camera_direction", "lighting", "transition", "production_directive", "character", "location"],
          continuity_checker: ["continuity_rule", "character", "wardrobe", "prop", "location", "chronology"],
          psychology_reviewer: ["character", "character_arc", "relationship", "emotional_arc", "dialogue_sample"],
          legal_ethics_reviewer: ["legal_note", "character", "location", "continuity_rule"],
          qa_reviewer: ["continuity_rule", "character", "scene", "production_directive"],
          editor: ["scene", "transition", "sound_design", "music", "camera_direction"],
          delivery_manager: ["format", "duration", "production_directive"],
        };
        const entityTypes = agentEntityMap[run.agent_slug] || ["character", "location", "scene", "continuity_rule", "mood"];

        // Prioritize governance docs
        const govDocIds = (docs || [])
          .filter((d: any) => d.document_role === "governance_doc" || d.source_priority === "source_of_truth")
          .map((d: any) => d.id);

        const { data: entities } = await supabase
          .from("source_document_entities")
          .select("entity_type, entity_key, entity_value, extraction_confidence, document_id")
          .in("document_id", docIds)
          .in("entity_type", entityTypes)
          .gte("extraction_confidence", 0.5)
          .in("status", ["confirmed", "proposed"])
          .order("extraction_confidence", { ascending: false })
          .limit(150);

        if (entities?.length) {
          // Sort: governance entities first, then by confidence
          const govSet = new Set(govDocIds);
          entities.sort((a: any, b: any) => {
            const aGov = govSet.has(a.document_id) ? 1 : 0;
            const bGov = govSet.has(b.document_id) ? 1 : 0;
            if (aGov !== bGov) return bGov - aGov;
            return b.extraction_confidence - a.extraction_confidence;
          });

          episodeContext.corpus_entities = entities.slice(0, 100).map((e: any) => ({
            type: e.entity_type,
            key: e.entity_key,
            value: e.entity_value,
            confidence: e.extraction_confidence,
            is_governance: govSet.has(e.document_id),
          }));
        }

        // Load production directives specifically
        const { data: prodDirectives } = await supabase
          .from("source_document_entities")
          .select("entity_type, entity_key, entity_value")
          .in("document_id", docIds)
          .in("entity_type", ["production_directive", "camera_direction", "lighting", "sound_design", "color_palette", "transition"])
          .gte("extraction_confidence", 0.6)
          .limit(50);
        if (prodDirectives?.length) {
          episodeContext.production_directives = prodDirectives.map((e: any) => ({
            type: e.entity_type,
            key: e.entity_key,
            value: e.entity_value,
          }));
        }
      }
    }

    const startTime = Date.now();

    try {
      // Call AI gateway with retry
      const aiResponse = await callAIWithRetry({
        agentSlug: run.agent_slug,
        promptTemplate: prompt?.content || getDefaultPrompt(run.agent_slug),
        input: run.input as Record<string, unknown>,
        context: episodeContext,
      }, 2); // max 2 retries

      const latencyMs = Date.now() - startTime;

      // Extract confidence score from AI response
      const confidence = typeof aiResponse.content?.confidence === "number"
        ? aiResponse.content.confidence
        : estimateConfidence(aiResponse);

      // Store output
      const { data: output } = await supabase
        .from("agent_outputs")
        .insert({
          agent_run_id: run.id,
          output_type: run.agent_slug,
          content: aiResponse.content || {},
        })
        .select()
        .single();

      // Write to specialized review tables if applicable
      if (run.episode_id) {
        await writeSpecializedOutput(supabase, run.agent_slug, run.id, run.episode_id, aiResponse.content);
      }

      // Store confidence score
      const triggerStatus = (run.input as Record<string, unknown>)?.trigger_status as string;
      const workflowStepId = (run.input as Record<string, unknown>)?.workflow_step_id as string;

      if (run.episode_id) {
        await supabase.from("workflow_confidence_scores").insert({
          workflow_step_id: workflowStepId || null,
          agent_run_id: run.id,
          episode_id: run.episode_id,
          dimension: run.agent_slug,
          score: confidence,
          details: {
            model: aiResponse.model,
            tokens: aiResponse.tokensUsed,
            latency_ms: latencyMs,
            is_fallback: aiResponse.model === "fallback",
          },
        });
      }

      // Mark run as completed
      await supabase
        .from("agent_runs")
        .update({
          status: "completed",
          output: aiResponse.content,
          completed_at: new Date().toISOString(),
          latency_ms: latencyMs,
          model_used: aiResponse.model || "gemini-2.5-flash",
          tokens_used: aiResponse.tokensUsed || 0,
          prompt_version: prompt?.version || 0,
        })
        .eq("id", run.id);

      // Update job_queue
      await supabase
        .from("job_queue")
        .update({ status: "completed" })
        .eq("payload->>agent_run_id", run.id);

      // Check if all agents for the current step are complete, then maybe advance
      if (run.episode_id && triggerStatus) {
        await maybeAdvanceEpisode(supabase, run.episode_id, triggerStatus, confidence);
      }

      // Audit log
      await supabase.from("audit_logs").insert({
        action: "agent_run_completed",
        entity_type: "agent_run",
        entity_id: run.id,
        details: {
          agent_slug: run.agent_slug,
          episode_id: run.episode_id,
          confidence,
          latency_ms: latencyMs,
          model: aiResponse.model,
          correlation_id: correlation_id || run.correlation_id,
        },
      });

      return new Response(JSON.stringify({
        run_id: run.id,
        status: "completed",
        output_id: output?.id,
        confidence,
        latency_ms: latencyMs,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (aiErr: unknown) {
      const errorMsg = aiErr instanceof Error ? aiErr.message : "AI call failed";
      const retryCount = (run.retry_count || 0) + 1;
      const maxRetries = run.max_retries || 3;

      // Update run with error info
      await supabase
        .from("agent_runs")
        .update({
          status: retryCount < maxRetries ? "queued" : "failed",
          error_message: errorMsg,
          completed_at: retryCount >= maxRetries ? new Date().toISOString() : null,
          latency_ms: Date.now() - startTime,
          retry_count: retryCount,
        })
        .eq("id", run.id);

      // Update job_queue
      await supabase
        .from("job_queue")
        .update({ status: retryCount < maxRetries ? "pending" : "failed" })
        .eq("payload->>agent_run_id", run.id);

      // If retries remaining, re-queue via dead letter
      if (retryCount < maxRetries) {
        // Schedule retry with exponential backoff
        console.log(`Retrying agent run ${run.id} (attempt ${retryCount + 1}/${maxRetries})`);
      }

      // Audit log the failure
      await supabase.from("audit_logs").insert({
        action: "agent_run_failed",
        entity_type: "agent_run",
        entity_id: run.id,
        details: {
          agent_slug: run.agent_slug,
          error: errorMsg,
          retry_count: retryCount,
          max_retries: maxRetries,
          will_retry: retryCount < maxRetries,
          correlation_id: correlation_id || run.correlation_id,
        },
      });

      throw aiErr;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function callAIWithRetry(
  params: {
    agentSlug: string;
    promptTemplate: string;
    input: Record<string, unknown>;
    context: Record<string, unknown>;
  },
  maxRetries: number
): Promise<{ content: Record<string, unknown>; model?: string; tokensUsed?: number }> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callAI(params);
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }
  throw lastError || new Error("AI call failed after retries");
}

async function callAI(params: {
  agentSlug: string;
  promptTemplate: string;
  input: Record<string, unknown>;
  context: Record<string, unknown>;
}): Promise<{ content: Record<string, unknown>; model?: string; tokensUsed?: number }> {
  const systemPrompt = params.promptTemplate
    .replace("{{input}}", JSON.stringify(params.input, null, 2))
    .replace("{{context}}", JSON.stringify(params.context, null, 2));

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Execute the ${params.agentSlug} agent task. Return a JSON object with: result (your output), confidence (0-1 score of how confident you are), issues (array of any problems found), and recommendations (array of suggestions).`,
        },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`AI gateway returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const content = JSON.parse(data.choices?.[0]?.message?.content || "{}");
  return {
    content,
    model: data.model,
    tokensUsed: data.usage?.total_tokens,
  };
}

function estimateConfidence(response: { content: Record<string, unknown>; model?: string }): number {
  if (response.model === "fallback") return 0.3;
  const issues = response.content?.issues;
  if (Array.isArray(issues) && issues.length > 0) return Math.max(0.5, 1 - issues.length * 0.1);
  if (response.content?.verdict === "block") return 0.2;
  if (response.content?.verdict === "flag") return 0.6;
  if (response.content?.verdict === "pass") return 0.95;
  return 0.75;
}

function getDefaultPrompt(agentSlug: string): string {
  const defaults: Record<string, string> = {
    showrunner: "Tu es le showrunner de la série. Orchestre la production, priorise les tâches, et valide la direction créative globale. Input: {{input}} Context: {{context}}",
    story_architect: "Tu es un architecte narratif. Analyse le synopsis et crée une structure narrative avec des arcs pour chaque personnage. Définis les thèmes, les enjeux et la progression dramatique. Input: {{input}} Context: {{context}}",
    scriptwriter: "Tu es un scénariste professionnel. Écris un script détaillé basé sur la structure narrative, avec des dialogues naturels, des indications de mise en scène et des transitions. Input: {{input}} Context: {{context}}",
    script_doctor: "Tu es un script doctor. Analyse le script existant, identifie les faiblesses narratives, les incohérences de dialogue et les problèmes de rythme. Propose des corrections précises. Input: {{input}} Context: {{context}}",
    dialogue_coach: "Tu es un coach dialogues. Affine les dialogues et la voix des personnages pour les rendre plus naturels et distincts. Input: {{input}} Context: {{context}}",
    psychology_reviewer: "Tu es un psychologue narratif. Évalue la cohérence psychologique des personnages, leurs motivations, et l'impact émotionnel sur le public. Retourne un verdict (pass/flag/block) avec les évaluations par personnage. Input: {{input}} Context: {{context}}",
    legal_ethics_reviewer: "Tu es un conseiller juridique et éthique. Vérifie que le contenu respecte les normes légales et éthiques (diffamation, droits d'auteur, représentation, sensibilité culturelle). Retourne un verdict (pass/flag/block). Input: {{input}} Context: {{context}}",
    continuity_checker: "Tu es un vérificateur de continuité. Compare l'épisode courant avec la mémoire de la série (personnages, costumes, lieux, timeline). Détecte toute incohérence. Retourne un verdict (pass/flag/block) avec la liste des problèmes. Input: {{input}} Context: {{context}}",
    visual_director: "Tu es un directeur visuel. Définis le style visuel, la palette de couleurs, l'éclairage et l'ambiance de la série. Crée la bible visuelle. Input: {{input}} Context: {{context}}",
    scene_designer: "Tu es un concepteur de scènes. Découpe l'épisode en scènes détaillées avec lieux, ambiances, personnages présents, et durée estimée. Input: {{input}} Context: {{context}}",
    shot_planner: "Tu es un planificateur de plans. Génère une shotlist détaillée à partir des scènes, avec cadrages, mouvements de caméra, et prompts de génération. Input: {{input}} Context: {{context}}",
    music_director: "Tu es un directeur musical. Sélectionne et synchronise la musique, définis les thèmes musicaux par personnage et par ambiance. Input: {{input}} Context: {{context}}",
    voice_director: "Tu es un directeur voix. Gère le casting vocal, la direction vocale et les indications de ton pour chaque personnage. Input: {{input}} Context: {{context}}",
    editor: "Tu es un monteur professionnel. Planifie le montage, les transitions, le rythme et l'assemblage final. Input: {{input}} Context: {{context}}",
    colorist: "Tu es un étalonneur. Applique l'étalonnage couleur et assure la cohérence visuelle entre les plans et les épisodes. Input: {{input}} Context: {{context}}",
    qa_reviewer: "Tu es un contrôleur qualité. Évalue la qualité globale (technique, narrative, visuelle, sonore). Identifie les problèmes et attribue un score de confiance. Retourne un verdict (pass/flag/block). Input: {{input}} Context: {{context}}",
    delivery_manager: "Tu es un responsable de livraison. Prépare les spécifications d'export, vérifie la conformité technique et prépare la distribution. Input: {{input}} Context: {{context}}",
    casting_consistency: "Tu es un directeur de casting. Vérifie la cohérence visuelle des personnages entre les épisodes (visages, proportions, costumes). Input: {{input}} Context: {{context}}",
    production_designer: "Tu es un chef décorateur. Conçois les décors, les ambiances et l'univers visuel cohérent de la série. Input: {{input}} Context: {{context}}",
    costume_designer: "Tu es un costumier. Définis les costumes de chaque personnage en cohérence avec la bible de la série et l'évolution narrative. Input: {{input}} Context: {{context}}",
    props_designer: "Tu es un accessoiriste. Définis les accessoires clés, leur apparence et leur cohérence entre les épisodes. Input: {{input}} Context: {{context}}",
    sound_music: "Tu es un ingénieur son. Définis la bande sonore, les effets sonores et le design audio de la série. Input: {{input}} Context: {{context}}",
    delivery_supervisor: "Tu es un superviseur de livraison. Valide la conformité technique finale avant export et distribution. Input: {{input}} Context: {{context}}",
  };
  return defaults[agentSlug] || `Tu es l'agent ${agentSlug}. Exécute ta tâche et retourne un résultat structuré avec confidence, issues et recommendations. Input: {{input}} Context: {{context}}`;
}

async function writeSpecializedOutput(
  supabase: ReturnType<typeof createClient>,
  agentSlug: string,
  agentRunId: string,
  episodeId: string,
  content: Record<string, unknown>
) {
  switch (agentSlug) {
    case "psychology_reviewer":
      await supabase.from("psychology_reviews").insert({
        episode_id: episodeId,
        agent_run_id: agentRunId,
        character_assessments: content.assessments || content.result?.assessments || [],
        verdict: content.verdict || "pass",
        recommendations: (content.recommendations as string) || null,
      });
      break;
    case "legal_ethics_reviewer":
      await supabase.from("legal_ethics_reviews").insert({
        episode_id: episodeId,
        agent_run_id: agentRunId,
        flags: content.flags || content.result?.flags || [],
        verdict: content.verdict || "pass",
        recommendations: (content.recommendations as string) || null,
      });
      break;
    case "continuity_checker":
      await supabase.from("continuity_reports").insert({
        episode_id: episodeId,
        agent_run_id: agentRunId,
        issues: content.issues || content.result?.issues || [],
        verdict: content.verdict || "pass",
        summary: (content.summary as string) || null,
      });
      break;
    case "scene_designer": {
      // Write scenes to scenes table
      const scenes = content.scenes || content.result?.scenes;
      if (Array.isArray(scenes)) {
        for (let i = 0; i < scenes.length; i++) {
          const scene = scenes[i] as Record<string, unknown>;
          await supabase.from("scenes").insert({
            episode_id: episodeId,
            idx: i + 1,
            title: scene.title || `Scene ${i + 1}`,
            description: scene.description || "",
            location: scene.location || "",
            time_of_day: scene.time_of_day || "",
            mood: scene.mood || "",
            duration_target_sec: scene.duration || null,
            characters: scene.characters || [],
          });
        }
      }
      break;
    }
    case "scriptwriter": {
      // Write script and first version
      const scriptContent = content.script || content.result?.script || "";
      const { data: script } = await supabase
        .from("scripts")
        .upsert({
          episode_id: episodeId,
          current_version: 1,
        }, { onConflict: "episode_id" })
        .select()
        .single();
      if (script) {
        await supabase.from("script_versions").insert({
          script_id: script.id,
          version: 1,
          content: typeof scriptContent === "string" ? scriptContent : JSON.stringify(scriptContent),
          change_summary: "Initial script generated by AI",
          created_by: "scriptwriter_agent",
        }).then(() => {}).catch(() => {
          // Version may already exist (idempotency)
        });
      }
      break;
    }
  }
}

async function maybeAdvanceEpisode(
  supabase: ReturnType<typeof createClient>,
  episodeId: string,
  triggerStatus: string,
  latestConfidence: number
) {
  const { data: episode } = await supabase
    .from("episodes")
    .select("status, workflow_run_id")
    .eq("id", episodeId)
    .single();
  if (!episode) return;

  const currentStatus = episode.status;
  if (currentStatus !== triggerStatus) return; // Status already changed

  const nextStatus = STATUS_TRANSITIONS[currentStatus];
  if (!nextStatus) return;

  // Check if all runs for this episode+status are completed
  const { data: pendingRuns } = await supabase
    .from("agent_runs")
    .select("id, status")
    .eq("episode_id", episodeId)
    .eq("input->>trigger_status", currentStatus)
    .in("status", ["queued", "running"]);

  if (pendingRuns && pendingRuns.length > 0) return; // Still running

  // Check for any failed runs
  const { data: failedRuns } = await supabase
    .from("agent_runs")
    .select("id")
    .eq("episode_id", episodeId)
    .eq("input->>trigger_status", currentStatus)
    .eq("status", "failed");

  if (failedRuns && failedRuns.length > 0) {
    // Mark episode as failed if agents failed
    await supabase.from("episodes").update({ status: "failed" }).eq("id", episodeId);
    if (episode.workflow_run_id) {
      await supabase.from("workflow_runs").update({ status: "failed", error_message: "Agent run(s) failed" }).eq("id", episode.workflow_run_id);
    }
    return;
  }

  // Check approval gate
  if (APPROVAL_REQUIRED_STEPS.has(currentStatus)) {
    // Get average confidence for this step
    const { data: scores } = await supabase
      .from("workflow_confidence_scores")
      .select("score")
      .eq("episode_id", episodeId)
      .eq("dimension", currentStatus.includes("review") || currentStatus.includes("check")
        ? currentStatus.replace("_review", "_reviewer").replace("_check", "_checker")
        : currentStatus);

    // Broader: get all scores for this step
    const avgScore = scores && scores.length > 0
      ? scores.reduce((sum, s) => sum + Number(s.score), 0) / scores.length
      : latestConfidence;

    const threshold = AUTO_APPROVE_THRESHOLDS[currentStatus] || 0.85;

    if (avgScore >= threshold) {
      // Auto-approve: confidence above threshold
      await supabase.from("approval_steps")
        .update({ status: "approved", notes: `Auto-approved: confidence ${(avgScore * 100).toFixed(1)}% >= threshold ${(threshold * 100).toFixed(1)}%` })
        .eq("episode_id", episodeId)
        .eq("step_name", currentStatus);

      // Update workflow approval
      if (episode.workflow_run_id) {
        const { data: wfStep } = await supabase
          .from("workflow_steps")
          .select("id")
          .eq("workflow_run_id", episode.workflow_run_id)
          .eq("step_key", currentStatus)
          .single();
        if (wfStep) {
          await supabase.from("workflow_approvals")
            .update({ decision: "approved", reason: `Auto-approved with confidence ${(avgScore * 100).toFixed(1)}%` })
            .eq("workflow_step_id", wfStep.id);
          await supabase.from("workflow_steps")
            .update({ status: "approved", completed_at: new Date().toISOString() })
            .eq("id", wfStep.id);
        }
      }
    } else {
      // Needs human approval — mark step as waiting
      if (episode.workflow_run_id) {
        const { data: wfStep } = await supabase
          .from("workflow_steps")
          .select("id")
          .eq("workflow_run_id", episode.workflow_run_id)
          .eq("step_key", currentStatus)
          .single();
        if (wfStep) {
          await supabase.from("workflow_steps")
            .update({ status: "waiting_approval" })
            .eq("id", wfStep.id);
        }
      }
      // Don't advance — wait for human
      return;
    }
  }

  // All checks passed: advance episode
  await supabase.from("episodes").update({ status: nextStatus }).eq("id", episodeId);

  // ── Governance state reconciliation ──
  // Sync project governance_state with pipeline progress
  const { data: epForGov } = await supabase
    .from("episodes")
    .select("season:seasons!episodes_season_id_fkey(series:series!seasons_series_id_fkey(project_id))")
    .eq("id", episodeId)
    .single();
  const govProjectId = (epForGov as any)?.season?.series?.project_id;
  if (govProjectId) {
    const PIPELINE_TO_GOVERNANCE: Record<string, string> = {
      story_development: "planning",
      psychology_review: "planning",
      legal_ethics_review: "planning",
      visual_bible: "setup_in_progress",
      continuity_check: "awaiting_scene_review",
      shot_generation: "generating",
      shot_review: "awaiting_clip_review",
      assembly: "assembling",
      edit_review: "awaiting_rough_cut_review",
      delivery: "exporting",
      completed: "delivered",
    };
    const govState = PIPELINE_TO_GOVERNANCE[nextStatus];
    if (govState) {
      await supabase.from("projects").update({ governance_state: govState }).eq("id", govProjectId);
    }
  }

  // Update workflow step as completed
  if (episode.workflow_run_id) {
    await supabase.from("workflow_steps")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("workflow_run_id", episode.workflow_run_id)
      .eq("step_key", currentStatus);

    // Update workflow run current step
    await supabase.from("workflow_runs").update({
      current_step_key: nextStatus === "completed" ? null : nextStatus,
      status: nextStatus === "completed" ? "completed" : "running",
      completed_at: nextStatus === "completed" ? new Date().toISOString() : null,
    }).eq("id", episode.workflow_run_id);
  }

  // Auto-continue pipeline if next step exists and is not terminal
  if (nextStatus !== "completed" && nextStatus !== "failed" && nextStatus !== "cancelled") {
    // Invoke episode-pipeline to process next step
    supabase.functions.invoke("episode-pipeline", {
      body: { episode_id: episodeId },
    }).catch((err: unknown) => {
      console.error(`Failed to auto-continue pipeline for episode ${episodeId}:`, err);
    });
  }
}
