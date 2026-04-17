import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity, AlertTriangle, FileWarning, Database, Clock, CheckCircle2,
  Loader2, RefreshCw, Skull, Shield, Wallet, ListChecks, GitBranch,
} from "lucide-react";
import { toast } from "sonner";
import InvariantCard from "@/components/admin/InvariantCard";
import LegacyDocsAlert from "@/components/admin/LegacyDocsAlert";
import DLQPanel from "@/components/admin/DLQPanel";
import PolicyModeSwitch from "@/components/admin/PolicyModeSwitch";
import { usePageTitle } from "@/hooks/usePageTitle";

interface HealthData {
  snapshot: Record<string, number | string | null>;
  health_score: number;
  stuck_agents: Array<{ id: string; agent_slug: string; status: string; started_at: string; chain_depth?: number }>;
  reaper_runs: Array<{
    id: string; started_at: string; completed_at: string | null;
    agent_runs_reaped: number; workflow_runs_reaped: number; exports_reaped: number;
  }>;
  budget_violations: Array<{ id: string; project_id: string | null; attempted_credits: number; blocked: boolean; created_at: string }>;
  transition_rules: Array<{ id: string; domain: string; to_state: string; required_predecessor: string | null; enforcement_mode: string }>;
  dlq_jobs: Array<{
    id: string; job_type: string; slug: string | null; episode_id: string | null;
    error_message: string | null; retry_count: number; max_retries: number;
    created_at: string; completed_at: string | null;
  }>;
  policies: Array<{ id: string; policy_key: string; domain: string; description: string | null; enforcement_mode: string }>;
  deep_chain_agents: Array<{ id: string; agent_slug: string; chain_depth: number; episode_id: string | null; created_at: string }>;
}

function ageMinutes(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 60000);
}

export default function ArchitectureHealth() {
  usePageTitle("Architecture Health — Admin");
  const [reaping, setReaping] = useState(false);

  const { data, isLoading, refetch } = useQuery<HealthData>({
    queryKey: ["architecture-health"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("architecture-health");
      if (error) throw error;
      return data as HealthData;
    },
    refetchInterval: 30_000,
  });

  // Auto-refetch every 30s also covered by react-query
  useEffect(() => {
    const id = setInterval(() => refetch(), 30_000);
    return () => clearInterval(id);
  }, [refetch]);

  const runReaper = async () => {
    setReaping(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("reaper");
      if (error) throw error;
      const total = (result?.reaped?.agent_runs ?? 0) + (result?.reaped?.workflow_runs ?? 0) + (result?.reaped?.exports ?? 0);
      toast.success(total > 0 ? `${total} job(s) zombie(s) marqué(s) comme failed` : "Aucun job zombie détecté");
      refetch();
    } catch (e) {
      toast.error(`Reaper failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setReaping(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const s = data.snapshot;
  const stuckTotal = (Number(s.agent_runs_stuck) || 0) + (Number(s.workflow_runs_stuck) || 0) + (Number(s.exports_stuck) || 0);
  const docsLegacyRatio = Number(s.docs_total) > 0 ? (Number(s.docs_legacy) / Number(s.docs_total)) * 100 : 0;
  const score = data.health_score;

  const scoreColor = score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-destructive";
  const scoreBadge = score >= 80 ? "Sain" : score >= 60 ? "Dégradé" : "Critique";

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto py-8 px-4 space-y-8">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Activity className="h-7 w-7 text-primary" />
              Architecture Health
            </h1>
            <p className="text-muted-foreground">
              Invariants temps réel — auto-refresh 30s · Snapshot : {new Date(String(s.snapshot_at)).toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Score</p>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-bold ${scoreColor}`}>{score}</span>
                <Badge variant="outline" className={scoreColor}>{scoreBadge}</Badge>
              </div>
            </div>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              Refresh
            </Button>
            <Button onClick={runReaper} disabled={reaping} size="sm">
              {reaping ? (
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              ) : (
                <Skull className="h-3.5 w-3.5 mr-2" />
              )}
              Run Reaper
            </Button>
          </div>
        </header>

        <LegacyDocsAlert />

        {/* Invariants grid */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <InvariantCard
            label="Agents bloqués"
            value={Number(s.agent_runs_stuck) || 0}
            icon={Clock}
            status={Number(s.agent_runs_stuck) > 0 ? "error" : "ok"}
            hint=">15 min en running/queued"
          />
          <InvariantCard
            label="Workflows bloqués"
            value={Number(s.workflow_runs_stuck) || 0}
            icon={Clock}
            status={Number(s.workflow_runs_stuck) > 0 ? "error" : "ok"}
            hint=">2h en running"
          />
          <InvariantCard
            label="Exports bloqués"
            value={Number(s.exports_stuck) || 0}
            icon={Clock}
            status={Number(s.exports_stuck) > 0 ? "error" : "ok"}
            hint=">1h en pending"
          />
          <InvariantCard
            label="Docs legacy"
            value={`${Math.round(docsLegacyRatio)}%`}
            icon={FileWarning}
            status={docsLegacyRatio > 50 ? "error" : docsLegacyRatio > 20 ? "warn" : "ok"}
            hint={`${s.docs_legacy}/${s.docs_total} avec ancien parseur`}
          />
          <InvariantCard
            label="Docs en échec"
            value={Number(s.docs_failed) || 0}
            icon={FileWarning}
            status={Number(s.docs_failed) > 0 ? "warn" : "ok"}
            hint="status = parsing_failed"
          />
          <InvariantCard
            label="Budget violations 7j"
            value={Number(s.budget_violations_7d) || 0}
            icon={Wallet}
            status={Number(s.budget_blocks_7d) > 0 ? "error" : Number(s.budget_violations_7d) > 0 ? "warn" : "ok"}
            hint={`${s.budget_blocks_7d} bloquées`}
          />
          <InvariantCard
            label="Gouvernance 7j"
            value={Number(s.governance_violations_7d) || 0}
            icon={Shield}
            status={Number(s.governance_violations_7d) > 5 ? "warn" : "ok"}
            hint="violations enregistrées"
          />
          <InvariantCard
            label="Incidents 7j"
            value={Number(s.incidents_7d) || 0}
            icon={AlertTriangle}
            status={Number(s.incidents_7d) > 0 ? "warn" : "ok"}
          />
          <InvariantCard
            label="Erreurs 7j"
            value={Number(s.errors_7d) || 0}
            icon={AlertTriangle}
            status={Number(s.errors_7d) > 10 ? "error" : Number(s.errors_7d) > 0 ? "warn" : "ok"}
            hint="diagnostic_events"
          />
          <InvariantCard
            label="Latence agent p50"
            value={s.avg_agent_latency_ms_24h ? `${s.avg_agent_latency_ms_24h}ms` : "—"}
            icon={Activity}
            status={Number(s.avg_agent_latency_ms_24h) > 10000 ? "warn" : "ok"}
            hint="moyenne 24h"
          />
          <InvariantCard
            label="Jobs reapés 7j"
            value={Number(s.jobs_reaped_7d) || 0}
            icon={Skull}
            status="ok"
            hint="reaper auto-cleanup"
          />
          <InvariantCard
            label="Dernier reaper"
            value={s.last_reaper_run ? `il y a ${ageMinutes(String(s.last_reaper_run))} min` : "Jamais"}
            icon={CheckCircle2}
            status={!s.last_reaper_run || ageMinutes(String(s.last_reaper_run)) > 60 ? "warn" : "ok"}
          />
        </section>

        {/* Detail tabs */}
        <Tabs defaultValue="stuck" className="w-full">
          <TabsList>
            <TabsTrigger value="stuck">Jobs bloqués ({stuckTotal})</TabsTrigger>
            <TabsTrigger value="reaper">Historique Reaper</TabsTrigger>
            <TabsTrigger value="budgets">Violations budget</TabsTrigger>
            <TabsTrigger value="rules">Règles de transitions</TabsTrigger>
          </TabsList>

          <TabsContent value="stuck">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Agents en running/queued depuis &gt;15 min
                </CardTitle>
                <CardDescription>
                  Cliquez "Run Reaper" en haut pour les marquer failed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.stuck_agents.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Aucun job bloqué ✨</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {data.stuck_agents.map((a) => (
                      <li key={a.id} className="py-3 flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{a.agent_slug}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.status} depuis {ageMinutes(a.started_at)} min
                          </p>
                        </div>
                        <code className="text-xs text-muted-foreground">{a.id.slice(0, 8)}</code>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reaper">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Skull className="h-4 w-4" /> Passages du Reaper
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.reaper_runs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Aucun passage enregistré.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {data.reaper_runs.map((r) => {
                      const total = r.agent_runs_reaped + r.workflow_runs_reaped + r.exports_reaped;
                      return (
                        <li key={r.id} className="py-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">
                              {new Date(r.started_at).toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {r.agent_runs_reaped} agents · {r.workflow_runs_reaped} workflows · {r.exports_reaped} exports
                            </p>
                          </div>
                          <Badge variant={total > 0 ? "default" : "outline"}>
                            {total} reapé{total > 1 ? "s" : ""}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="budgets">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wallet className="h-4 w-4" /> Violations de budget
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.budget_violations.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Aucune violation 🎉</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {data.budget_violations.map((v) => (
                      <li key={v.id} className="py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">
                            {v.attempted_credits} crédits tentés
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(v.created_at).toLocaleString()} · projet {v.project_id?.slice(0, 8) ?? "—"}
                          </p>
                        </div>
                        <Badge variant={v.blocked ? "destructive" : "outline"}>
                          {v.blocked ? "Bloqué" : "Shadow"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rules">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ListChecks className="h-4 w-4" /> Règles de transition
                </CardTitle>
                <CardDescription>
                  Configurées en base — modifiables via SQL (UI à venir en P1).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border">
                  {data.transition_rules.map((r) => (
                    <li key={r.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {r.domain} → <code className="text-primary">{r.to_state}</code>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.required_predecessor
                            ? `Requiert prédécesseur : ${r.required_predecessor}`
                            : "Pas de prédécesseur requis"}
                        </p>
                      </div>
                      <Badge
                        variant={r.enforcement_mode === "enforce" ? "default" : "outline"}
                        className={r.enforcement_mode === "shadow" ? "text-amber-400 border-amber-500/40" : ""}
                      >
                        {r.enforcement_mode}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-start gap-3">
            <Database className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-medium">Score de santé pondéré</p>
              <p className="text-muted-foreground">
                100 - jobs zombies×5 - docs legacy (10 ou 20) - errors&gt;10 (15) - budget bloqué (10) - parser failed (10).
                Cible &gt;80 pour Go-Live.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
