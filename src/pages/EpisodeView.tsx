import { useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEpisode } from "@/hooks/useEpisodes";
import { useScript } from "@/hooks/useScripts";
import { useAgentRuns } from "@/hooks/useAgentRuns";
import { usePsychologyReviews, useLegalEthicsReviews, useContinuityReports } from "@/hooks/useReviews";
import { EpisodePipeline } from "@/components/series/EpisodePipeline";
import { SceneBreakdown } from "@/components/series/SceneBreakdown";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Loader2, FileText, Layers, Play, Activity, Shield, Brain, Scale, Eye, CheckCircle, AlertTriangle } from "lucide-react";

export default function EpisodeView() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const { data: episode, isLoading } = useEpisode(episodeId);
  const { data: script } = useScript(episodeId);
  const { data: agentRuns } = useAgentRuns({ episodeId });
  const { data: psychReviews } = usePsychologyReviews(episodeId);
  const { data: legalReviews } = useLegalEthicsReviews(episodeId);
  const { data: continuityReports } = useContinuityReports(episodeId);

  usePageTitle(episode ? `Ép. ${episode.number} — ${episode.title}` : "Épisode");

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
    ?.sort((a: any, b: any) => b.version - a.version)?.[0];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container max-w-5xl py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">
              Épisode {episode.number} — {episode.title}
            </h1>
            <Badge variant="secondary">{episode.status}</Badge>
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
            <SceneBreakdown episodeId={episode.id} />
          </TabsContent>

          <TabsContent value="agents">
            {agentRuns && agentRuns.length > 0 ? (
              <div className="space-y-2">
                {agentRuns.map((run: any) => (
                  <div key={run.id} className="border rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <span className="font-medium">{run.agent?.name || run.agent_slug}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        {run.agent?.category}
                      </span>
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
              <p className="text-sm text-muted-foreground py-4 text-center">
                Aucune exécution d'agent pour cet épisode.
              </p>
            )}
          </TabsContent>

          <TabsContent value="reviews">
            <p className="text-sm text-muted-foreground py-4 text-center">
              Les revues (psychologie, juridique, continuité) apparaîtront ici après les étapes de validation.
            </p>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}
