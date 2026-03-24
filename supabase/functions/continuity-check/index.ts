import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * continuity-check: Standalone continuity verification for an episode.
 * Compares episode content against the series continuity memory graph.
 * Returns conflicts and updates the memory graph with new facts.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { episode_id, series_id } = body;
    if (!episode_id) throw new Error("episode_id required");

    // Fetch episode with context
    const { data: episode, error: epErr } = await supabase
      .from("episodes")
      .select(`*, season:seasons!episodes_season_id_fkey(id, series_id, number)`)
      .eq("id", episode_id)
      .single();
    if (epErr || !episode) throw new Error("Episode not found");

    const resolvedSeriesId = series_id || episode.season?.series_id;
    if (!resolvedSeriesId) throw new Error("Cannot determine series_id");

    // Fetch all memory nodes for the series
    const { data: memoryNodes } = await supabase
      .from("continuity_memory_nodes")
      .select("*")
      .eq("series_id", resolvedSeriesId)
      .eq("is_active", true);

    // Fetch edges
    const { data: memoryEdges } = await supabase
      .from("continuity_memory_edges")
      .select("*")
      .eq("series_id", resolvedSeriesId);

    // Fetch existing continuity reports for previous episodes
    const { data: previousReports } = await supabase
      .from("continuity_reports")
      .select("*")
      .neq("episode_id", episode_id)
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch current episode's script
    const { data: script } = await supabase
      .from("scripts")
      .select("*, script_versions(content, version)")
      .eq("episode_id", episode_id)
      .single();

    // Fetch current episode's scenes
    const { data: scenes } = await supabase
      .from("scenes")
      .select("*")
      .eq("episode_id", episode_id)
      .order("idx");

    // Fetch characters
    const { data: characters } = await supabase
      .from("character_profiles")
      .select("*")
      .eq("series_id", resolvedSeriesId);

    // Build continuity context
    const continuityContext = {
      episode,
      memory_nodes: memoryNodes || [],
      memory_edges: memoryEdges || [],
      previous_reports: previousReports || [],
      script: script?.script_versions?.[0]?.content || null,
      scenes: scenes || [],
      characters: characters || [],
    };

    // Call AI for continuity analysis
    let analysis;
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `Tu es un vérificateur de continuité série expert. Analyse l'épisode courant par rapport à la mémoire de continuité de la série.

Vérifie:
1. Cohérence des personnages (apparence, personnalité, relations)
2. Cohérence des costumes et accessoires
3. Cohérence des lieux et décors
4. Cohérence de la timeline
5. Cohérence des dialogues (pas de contradictions avec des épisodes précédents)
6. Cohérence visuelle (style, palette)

Pour chaque problème trouvé, spécifie: type, severity (info/warning/error/critical), description, nodes concernés.

Retourne un JSON avec:
- verdict: "pass" | "flag" | "block"
- confidence: 0-1
- conflicts: [{type, severity, description, affected_elements}]
- new_facts: [{node_type, label, properties}] (nouveaux éléments à ajouter à la mémoire)
- new_edges: [{source_label, target_label, edge_type, properties}]
- summary: string`,
            },
            { role: "user", content: JSON.stringify(continuityContext) },
          ],
          temperature: 0.3,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) throw new Error(`AI returned ${response.status}`);
      const data = await response.json();
      analysis = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    } catch {
      analysis = {
        verdict: "flag",
        confidence: 0.5,
        conflicts: [],
        new_facts: [],
        new_edges: [],
        summary: "AI analysis unavailable — manual review recommended",
      };
    }

    // Store conflicts
    const conflicts = analysis.conflicts || [];
    for (const conflict of conflicts) {
      await supabase.from("continuity_conflicts").insert({
        series_id: resolvedSeriesId,
        episode_id: episode_id,
        conflict_type: mapConflictType(conflict.type),
        severity: conflict.severity || "warning",
        description: conflict.description || "Unknown conflict",
      });
    }

    // Update memory graph with new facts
    const newFacts = analysis.new_facts || [];
    for (const fact of newFacts) {
      await supabase.from("continuity_memory_nodes").insert({
        series_id: resolvedSeriesId,
        node_type: fact.node_type || "event",
        label: fact.label,
        properties: fact.properties || {},
        first_appearance_episode: episode_id,
        last_updated_episode: episode_id,
      });
    }

    // Store confidence score
    await supabase.from("workflow_confidence_scores").insert({
      episode_id: episode_id,
      dimension: "continuity",
      score: analysis.confidence || 0.5,
      details: {
        conflicts_found: conflicts.length,
        new_facts_added: newFacts.length,
        verdict: analysis.verdict,
      },
    });

    return new Response(JSON.stringify({
      verdict: analysis.verdict,
      confidence: analysis.confidence,
      conflicts_count: conflicts.length,
      new_facts_count: newFacts.length,
      summary: analysis.summary,
    }), {
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

function mapConflictType(type: string): string {
  const mapping: Record<string, string> = {
    character: "character_appearance",
    costume: "costume_change",
    prop: "prop_inconsistency",
    location: "location_error",
    timeline: "timeline_error",
    dialogue: "dialogue_contradiction",
    visual: "visual_mismatch",
  };
  return mapping[type] || mapping[type?.toLowerCase()] || "visual_mismatch";
}
