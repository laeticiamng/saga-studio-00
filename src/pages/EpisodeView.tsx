import { useParams, Link } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEpisode } from "@/hooks/useEpisodes";
import { useScript } from "@/hooks/useScripts";
import { useAgentRuns } from "@/hooks/useAgentRuns";
import { usePsychologyReviews, useLegalEthicsReviews, useContinuityReports } from "@/hooks/useReviews";
import { useStartAutopilot } from "@/hooks/useWorkflow";
import { EpisodePipeline } from "@/components/series/EpisodePipeline";
import { SceneBreakdown } from "@/components/series/SceneBreakdown";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Loader2, FileText, Layers, Play, Activity, Shield, Brain, Scale, Eye, CheckCircle, AlertTriangle, Clock, Rocket } from "lucide-react";
import { useSeries } from "@/hooks/useSeries";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function EpisodeView() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const queryClient = useQueryClient();
  const { data: episode, isLoading } = useEpisode(episodeId);
  const seasonData = episode?.season as { id: string; number: number; title: string | null; series_id: string } | null;
  const { data: series } = useSeries(seasonData?.series_id);
  const seriesProject = series?.project as Record<string, unknown> | null;
  const { data: script } = useScript(episodeId);
  const { data: agentRuns } = useAgentRuns({ episodeId });
  const startAutopilot = useStartAutopilot();
  const { data: psychReviews } = usePsychologyReviews(episodeId);
  const { data: legalReviews } = useLegalEthicsReviews(episodeId);
  const { data: continuityReports } = useContinuityReports(episodeId);

  usePageTitle(episode ? `Ép. ${episode.number} — ${episode.title}` : "Épisode");

  // Realtime: auto-refresh agent_runs and episode when pipeline is active
  useEffect(() => {
    if (!episodeId) return;
    const channel = supabase
      .channel(`episode-${episodeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_runs", filter: `episode_id=eq.${episodeId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["agent_runs", { episodeId }] });
        queryClient.invalidateQueries({ queryKey: ["episode", episodeId] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "episodes", filter: `id=eq.${episodeId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["episode", episodeId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [episodeId, queryClient]);

  const handleStartAutopilot = async () => {
    if (!episodeId) return;
    try {
      await startAutopilot.mutateAsync({ episodeId });
      toast.success("Autopilot démarré pour cet épisode");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur au démarrage");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Épisode non trouvé</p>
        </main>
      </div>
    );
  }

  const currentVersion = script?.versions
    ?.sort((a: { version: number }, b: { version: number }) => b.version - a.version)?.[0];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container max-w-5xl py-8">
        <Breadcrumbs items={[
          { label: "Mes projets", href: "/dashboard" },
          ...(seasonData ? [
            { label: String(seriesProject?.title || "Série"), href: `/series/${seasonData.series_id}` },
            { label: `Saison ${seasonData.number}`, href: `/series/${seasonData.series_id}/season/${seasonData.id}` },
          ] : []),
          { label: `Ép. ${episode.number} — ${episode.title}` },
        ]} />
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">
              Épisode {episode.number} — {episode.title}
            </h1>
            <Badge variant="secondary">{episode.status}</Badge>
            {episode.duration_target_min && (
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                {episode.duration_target_min} min
              </Badge>
            )}
            {episode.status === "draft" && (
              <Button size="sm" onClick={handleStartAutopilot} disabled={startAutopilot.isPending} className="ml-auto">
                {startAutopilot.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Rocket className="h-4 w-4 mr-1" />}
                Lancer l'autopilot
              </Button>
            )}
          </div>
          {episode.synopsis && (
            <p className="text-muted-foreground max-w-2xl">{episode.synopsis}</p>
          )}
        </div>

        {/* Pipeline Progress */}
        <div className="mb-6">
          <EpisodePipeline episodeId={episode.id} currentStatus={episode.status} />
        </div>

        <Tabs defaultValue="script" className="space-y-4">
          <TabsList>
            <TabsTrigger value="script">
              <FileText className="h-4 w-4 mr-1" />Script
            </TabsTrigger>
            <TabsTrigger value="scenes">
              <Layers className="h-4 w-4 mr-1" />Scènes
            </TabsTrigger>
            <TabsTrigger value="agents">
              <Activity className="h-4 w-4 mr-1" />Agents
            </TabsTrigger>
            <TabsTrigger value="reviews">
              <Shield className="h-4 w-4 mr-1" />Revues
            </TabsTrigger>
          </TabsList>

          <TabsContent value="script">
            {currentVersion ? (
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">
                    Version {currentVersion.version}
                    {currentVersion.change_summary && ` — ${currentVersion.change_summary}`}
                  </span>
                </div>
                <pre className="whitespace-pre-wrap text-sm font-mono bg-muted/50 p-4 rounded-md max-h-[500px] overflow-auto">
                  {currentVersion.content}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Aucun script. Le scénariste le créera lors du développement narratif.
              </p>
            )}
          </TabsContent>

          <TabsContent value="scenes">
            <SceneBreakdown episodeId={episode.id} durationTargetMin={episode.duration_target_min} />
          </TabsContent>

          <TabsContent value="agents">
            {agentRuns && agentRuns.length > 0 ? (
              <div className="space-y-2">
                {agentRuns.map((run) => (
                  <div key={run.id} className="border rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <span className="font-medium">{run.agent_slug}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {run.latency_ms && (
                        <span className="text-xs text-muted-foreground">{run.latency_ms}ms</span>
                      )}
                      <Badge variant={
                        run.status === "completed" ? "secondary" :
                        run.status === "failed" ? "destructive" :
                        run.status === "running" ? "default" : "outline"
                      }>
                        {run.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Aucune exécution d'agent pour cet épisode.
                </p>
                {seasonData && (
                  <p className="text-xs text-muted-foreground">
                    Lancez l'<a href={`/series/${seasonData.series_id}/autopilot`} className="text-primary hover:underline">Autopilot</a> pour déclencher les agents automatiquement.
                  </p>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reviews" className="space-y-4">
            {/* Psychology Reviews */}
            {psychReviews && psychReviews.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Brain className="h-5 w-5" /> Revues psychologiques</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {psychReviews.map((r) => {
                    const assessments = Array.isArray(r.character_assessments) ? r.character_assessments as Array<Record<string, unknown>> : [];
                    return (
                    <div key={r.id} className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={r.verdict === "pass" ? "secondary" : "destructive"}>{r.verdict}</Badge>
                      </div>
                      {r.recommendations && <p className="text-sm text-muted-foreground">{r.recommendations}</p>}
                      {assessments.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {assessments.map((a, i) => (
                            <p key={i} className="text-xs text-muted-foreground">• {String(a.character || a.name)}: {String(a.assessment || a.note || JSON.stringify(a))}</p>
                          ))}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Legal/Ethics Reviews */}
            {legalReviews && legalReviews.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Scale className="h-5 w-5" /> Revues juridiques/éthiques</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {legalReviews.map((r) => {
                    const flags = Array.isArray(r.flags) ? r.flags as Array<Record<string, unknown>> : [];
                    return (
                    <div key={r.id} className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={r.verdict === "pass" ? "secondary" : "destructive"}>{r.verdict}</Badge>
                      </div>
                      {r.recommendations && <p className="text-sm text-muted-foreground">{r.recommendations}</p>}
                      {flags.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {flags.map((f, i) => (
                            <p key={i} className="text-xs flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> {String(f.description || f.flag || JSON.stringify(f))}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Continuity Reports */}
            {continuityReports && continuityReports.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Eye className="h-5 w-5" /> Rapports de continuité</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {continuityReports.map((r) => {
                    const issues = Array.isArray(r.issues) ? r.issues as Array<Record<string, unknown>> : [];
                    return (
                    <div key={r.id} className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={r.verdict === "pass" ? "secondary" : "destructive"}>{r.verdict}</Badge>
                      </div>
                      {r.summary && <p className="text-sm text-muted-foreground">{r.summary}</p>}
                      {issues.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {issues.map((issue, i) => (
                            <p key={i} className="text-xs flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> {String(issue.description || JSON.stringify(issue))}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {(!psychReviews?.length && !legalReviews?.length && !continuityReports?.length) && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Les revues (psychologie, juridique, continuité) apparaîtront ici après les étapes de validation.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}
