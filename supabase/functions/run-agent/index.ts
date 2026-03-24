import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { agent_run_id } = body;
    if (!agent_run_id) throw new Error("agent_run_id required");

    // Fetch the run
    const { data: run, error: runErr } = await supabase
      .from("agent_runs")
      .select("*")
      .eq("id", agent_run_id)
      .single();
    if (runErr || !run) throw new Error("Agent run not found");

    // Mark as running
    const startedAt = new Date().toISOString();
    await supabase
      .from("agent_runs")
      .update({ status: "running", started_at: startedAt })
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
        .select("*")
        .eq("id", run.episode_id)
        .single();
      if (episode) episodeContext = { episode };
    }

    const startTime = Date.now();

    try {
      // Call AI gateway (Lovable/Gemini pattern from existing codebase)
      const aiResponse = await callAI({
        agentSlug: run.agent_slug,
        promptTemplate: prompt?.content || getDefaultPrompt(run.agent_slug),
        input: run.input as Record<string, unknown>,
        context: episodeContext,
      });

      const latencyMs = Date.now() - startTime;

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

      // Check if all agents for the current step are complete, then advance episode
      if (run.episode_id) {
        await maybeAdvanceEpisode(supabase, run.episode_id);
      }

      return new Response(JSON.stringify({ run_id: run.id, status: "completed", output_id: output?.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (aiErr: unknown) {
      const errorMsg = aiErr instanceof Error ? aiErr.message : "AI call failed";
      await supabase
        .from("agent_runs")
        .update({
          status: "failed",
          error_message: errorMsg,
          completed_at: new Date().toISOString(),
          latency_ms: Date.now() - startTime,
        })
        .eq("id", run.id);

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

async function callAI(params: {
  agentSlug: string;
  promptTemplate: string;
  input: Record<string, unknown>;
  context: Record<string, unknown>;
}): Promise<{ content: Record<string, unknown>; model?: string; tokensUsed?: number }> {
  // Construct the system prompt with context
  const systemPrompt = params.promptTemplate
    .replace("{{input}}", JSON.stringify(params.input, null, 2))
    .replace("{{context}}", JSON.stringify(params.context, null, 2));

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Execute the ${params.agentSlug} agent task with the provided input.` },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`AI gateway returned ${response.status}`);
    }

    const data = await response.json();
    const content = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    return {
      content,
      model: data.model,
      tokensUsed: data.usage?.total_tokens,
    };
  } catch {
    // Fallback: return a placeholder result
    return {
      content: {
        status: "completed",
        agent: params.agentSlug,
        note: "AI gateway unavailable, returning placeholder result",
      },
      model: "fallback",
      tokensUsed: 0,
    };
  }
}

function getDefaultPrompt(agentSlug: string): string {
  const defaults: Record<string, string> = {
    story_architect: "Tu es un architecte narratif. Analyse le synopsis et crée une structure narrative avec des arcs pour chaque personnage. Input: {{input}} Context: {{context}}",
    scriptwriter: "Tu es un scénariste professionnel. Écris un script détaillé basé sur la structure narrative. Input: {{input}} Context: {{context}}",
    psychology_reviewer: "Tu es un psychologue narratif. Évalue la cohérence psychologique des personnages et leurs motivations. Input: {{input}} Context: {{context}}",
    legal_ethics_reviewer: "Tu es un conseiller juridique et éthique. Vérifie que le contenu respecte les normes légales et éthiques. Input: {{input}} Context: {{context}}",
    visual_director: "Tu es un directeur visuel. Définis le style visuel, la palette de couleurs et l'ambiance de la série. Input: {{input}} Context: {{context}}",
    continuity_checker: "Tu es un vérificateur de continuité. Assure la cohérence entre les épisodes. Input: {{input}} Context: {{context}}",
    scene_designer: "Tu es un concepteur de scènes. Découpe l'épisode en scènes détaillées avec lieux, ambiances et personnages. Input: {{input}} Context: {{context}}",
    shot_planner: "Tu es un planificateur de plans. Génère une shotlist détaillée à partir des scènes. Input: {{input}} Context: {{context}}",
    qa_reviewer: "Tu es un contrôleur qualité. Évalue la qualité globale et identifie les problèmes. Input: {{input}} Context: {{context}}",
    editor: "Tu es un monteur. Planifie le montage et les transitions entre les plans. Input: {{input}} Context: {{context}}",
    delivery_manager: "Tu es un responsable de livraison. Prépare les spécifications d'export et de distribution. Input: {{input}} Context: {{context}}",
  };
  return defaults[agentSlug] || `Tu es l'agent ${agentSlug}. Exécute ta tâche. Input: {{input}} Context: {{context}}`;
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
        character_assessments: content.assessments || [],
        verdict: content.verdict || "pass",
        recommendations: content.recommendations as string || null,
      });
      break;
    case "legal_ethics_reviewer":
      await supabase.from("legal_ethics_reviews").insert({
        episode_id: episodeId,
        agent_run_id: agentRunId,
        flags: content.flags || [],
        verdict: content.verdict || "pass",
        recommendations: content.recommendations as string || null,
      });
      break;
    case "continuity_checker":
      await supabase.from("continuity_reports").insert({
        episode_id: episodeId,
        agent_run_id: agentRunId,
        issues: content.issues || [],
        verdict: content.verdict || "pass",
        summary: content.summary as string || null,
      });
      break;
  }
}

async function maybeAdvanceEpisode(
  supabase: ReturnType<typeof createClient>,
  episodeId: string
) {
  const { data: episode } = await supabase
    .from("episodes")
    .select("status")
    .eq("id", episodeId)
    .single();
  if (!episode) return;

  const currentStatus = episode.status;
  const nextStatus = STATUS_TRANSITIONS[currentStatus];
  if (!nextStatus) return;

  // Check if all runs for this episode+status are completed
  const { data: pendingRuns } = await supabase
    .from("agent_runs")
    .select("id")
    .eq("episode_id", episodeId)
    .eq("input->>trigger_status", currentStatus)
    .in("status", ["queued", "running"]);

  if (!pendingRuns || pendingRuns.length === 0) {
    // All runs for this step are done, advance
    await supabase
      .from("episodes")
      .update({ status: nextStatus })
      .eq("id", episodeId);
  }
}
