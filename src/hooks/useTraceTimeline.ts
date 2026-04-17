import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TraceEvent {
  source: "agent_run" | "audit_log" | "diagnostic_event";
  id: string;
  ts: string;
  title: string;
  detail?: string;
  status?: string;
  severity?: string;
  raw?: unknown;
}

export function useTraceTimeline(correlationId: string | undefined) {
  return useQuery({
    queryKey: ["trace-timeline", correlationId],
    enabled: !!correlationId,
    queryFn: async (): Promise<TraceEvent[]> => {
      if (!correlationId) return [];

      const [agents, audits, diags] = await Promise.all([
        supabase.from("agent_runs")
          .select("id, agent_slug, status, created_at, started_at, completed_at, error_message, chain_depth")
          .eq("correlation_id", correlationId).order("created_at", { ascending: true }),
        supabase.from("audit_logs")
          .select("id, action, entity_type, entity_id, created_at, details")
          .eq("correlation_id", correlationId).order("created_at", { ascending: true }),
        supabase.from("diagnostic_events")
          .select("id, event_type, severity, scope, title, detail, created_at, raw_data")
          .eq("correlation_id", correlationId).order("created_at", { ascending: true }),
      ]);

      const events: TraceEvent[] = [];
      for (const a of agents.data ?? []) {
        events.push({
          source: "agent_run", id: a.id,
          ts: a.created_at,
          title: `Agent ${a.agent_slug}`,
          detail: a.error_message ?? `depth=${a.chain_depth ?? 0}`,
          status: a.status,
          raw: a,
        });
      }
      for (const l of audits.data ?? []) {
        events.push({
          source: "audit_log", id: l.id,
          ts: l.created_at,
          title: l.action,
          detail: `${l.entity_type}${l.entity_id ? " " + l.entity_id.slice(0, 8) : ""}`,
          raw: l,
        });
      }
      for (const d of diags.data ?? []) {
        events.push({
          source: "diagnostic_event", id: d.id,
          ts: d.created_at,
          title: d.title,
          detail: d.detail ?? d.event_type,
          severity: d.severity,
          raw: d,
        });
      }
      return events.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    },
  });
}
