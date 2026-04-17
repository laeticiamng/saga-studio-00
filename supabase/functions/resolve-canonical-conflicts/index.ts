import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOrCreateCorrelationId } from "../_shared/correlation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-correlation-id",
};

/**
 * Cron-driven (every 15 min) resolver for canonical_conflicts using configurable
 * conflict_resolution_rules. Strategies: most_recent | highest_confidence | source_priority.
 * Manual rules (or unresolved fields) are skipped — humans must decide.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const correlationId = getOrCreateCorrelationId(req);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: rules } = await supabase
      .from("conflict_resolution_rules")
      .select("*")
      .eq("is_active", true);

    if (!rules?.length) {
      return new Response(JSON.stringify({ resolved: 0, reason: "no_rules" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: conflicts } = await supabase
      .from("canonical_conflicts")
      .select("*")
      .is("resolved_at", null)
      .limit(100);

    if (!conflicts?.length) {
      return new Response(JSON.stringify({ resolved: 0, reason: "no_pending_conflicts", correlation_id: correlationId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let resolvedCount = 0;
    const skipped: string[] = [];

    for (const c of conflicts) {
      const rule = rules.find((r) => r.entity_type === c.entity_type && r.field_key === c.field_key);
      if (!rule || rule.strategy === "manual") {
        skipped.push(c.id);
        continue;
      }

      let chosen: { value: unknown; doc_id: string | null } | null = null;

      if (rule.strategy === "most_recent") {
        // Pick the doc updated latest
        const { data: docs } = await supabase
          .from("source_documents")
          .select("id, updated_at, created_at")
          .in("id", [c.doc_a_id, c.doc_b_id].filter(Boolean));
        const latest = (docs ?? []).sort((a, b) =>
          new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime()
        )[0];
        chosen = latest?.id === c.doc_a_id
          ? { value: c.value_a, doc_id: c.doc_a_id }
          : { value: c.value_b, doc_id: c.doc_b_id };
      } else if (rule.strategy === "highest_confidence") {
        const { data: cfA } = await supabase
          .from("canonical_fields").select("confidence")
          .eq("project_id", c.project_id).eq("field_key", c.field_key)
          .eq("source_document_id", c.doc_a_id).maybeSingle();
        const { data: cfB } = await supabase
          .from("canonical_fields").select("confidence")
          .eq("project_id", c.project_id).eq("field_key", c.field_key)
          .eq("source_document_id", c.doc_b_id).maybeSingle();
        chosen = (cfA?.confidence ?? 0) >= (cfB?.confidence ?? 0)
          ? { value: c.value_a, doc_id: c.doc_a_id }
          : { value: c.value_b, doc_id: c.doc_b_id };
      } else if (rule.strategy === "source_priority") {
        const PRIORITY: Record<string, number> = {
          source_of_truth: 5, preferred_source: 4, supporting_reference: 3, draft_only: 2, deprecated: 1,
        };
        const { data: docs } = await supabase
          .from("source_documents")
          .select("id, source_priority")
          .in("id", [c.doc_a_id, c.doc_b_id].filter(Boolean));
        const winner = (docs ?? []).sort((a, b) =>
          (PRIORITY[b.source_priority ?? "supporting_reference"] ?? 3)
          - (PRIORITY[a.source_priority ?? "supporting_reference"] ?? 3)
        )[0];
        chosen = winner?.id === c.doc_a_id
          ? { value: c.value_a, doc_id: c.doc_a_id }
          : { value: c.value_b, doc_id: c.doc_b_id };
      }

      if (!chosen) { skipped.push(c.id); continue; }

      // Apply resolution
      await supabase.from("canonical_conflicts").update({
        resolution: "auto",
        canonical_value: chosen.value as never,
        resolved_at: new Date().toISOString(),
        notes: `Auto-resolved via ${rule.strategy}`,
      }).eq("id", c.id);

      await supabase.from("canonical_fields").update({
        canonical_value: chosen.value as never,
        source_document_id: chosen.doc_id,
      }).eq("project_id", c.project_id).eq("field_key", c.field_key).eq("entity_type", c.entity_type);

      await supabase.from("conflict_resolution_log").insert({
        conflict_id: c.id,
        project_id: c.project_id,
        rule_id: rule.id,
        strategy_used: rule.strategy,
        resolved_value: chosen.value as never,
      });

      await supabase.from("diagnostic_events").insert({
        project_id: c.project_id,
        severity: "info",
        scope: "ingestion",
        event_type: "canonical_conflict_auto_resolved",
        title: `Conflit canonical résolu: ${c.field_key}`,
        detail: `Strategy: ${rule.strategy}`,
        correlation_id: correlationId,
        raw_data: { conflict_id: c.id, rule_id: rule.id },
      });

      resolvedCount++;
    }

    return new Response(JSON.stringify({
      resolved: resolvedCount,
      skipped: skipped.length,
      correlation_id: correlationId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message, correlation_id: correlationId }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
