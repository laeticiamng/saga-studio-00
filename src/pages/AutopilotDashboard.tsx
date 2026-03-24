import { useParams } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useEpisodes } from "@/hooks/useEpisodes";
import { useWorkflowRun, useWorkflowSteps, useConfidenceScores, useStartAutopilot, usePauseWorkflow, useResumeWorkflow, useCancelWorkflow } from "@/hooks/useWorkflow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Play, Pause, RotateCcw, X, CheckCircle, Clock, AlertTriangle, Zap } from "lucide-react";
import { useState } from "react";

const STEP_LABELS: Record<string, string> = {
  story_development: "Développement narratif",
  psychology_review: "Revue psychologique",
  legal_ethics_review: "Revue juridique/éthique",
  visual_bible: "Bible visuelle",
  continuity_check: "Vérification continuité",
  shot_generation: "Génération de plans",
  shot_review: "Revue des plans",
  assembly: "Assemblage",
  edit_review: "Revue montage",
  delivery: "Livraison",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-400",
  running: "bg-blue-500 animate-pulse",
  waiting_approval: "bg-yellow-500",
  approved: "bg-green-500",
  rejected: "bg-red-500",
  completed: "bg-green-600",
  failed: "bg-red-600",
  skipped: "bg-gray-300",
};

export default function AutopilotDashboard() {
  usePageTitle("Autopilot");
  const { id: seriesId } = useParams<{ id: string }>();
  const { data: episodes } = useEpisodes(undefined, seriesId);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);

  const activeEpisodeId = selectedEpisodeId || episodes?.[0]?.id;
  const { data: workflowRun, isLoading: wrLoading } = useWorkflowRun(activeEpisodeId);
  const { data: steps } = useWorkflowSteps(workflowRun?.id);
  const { data: confidenceScores } = useConfidenceScores(activeEpisodeId);

  const startAutopilot = useStartAutopilot();
  const pauseWorkflow = usePauseWorkflow();
  const resumeWorkflow = useResumeWorkflow();
  const cancelWorkflow = useCancelWorkflow();

  const completedSteps = steps?.filter(s => s.status === "completed" || s.status === "approved").length || 0;
  const totalSteps = 10;
  const progress = (completedSteps / totalSteps) * 100;

  const handleStart = async (episodeId: string) => {
    try {
      await startAutopilot.mutateAsync({ episodeId });
      toast.success("Autopilot démarré");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur au démarrage");
    }
  };

  const handlePause = async () => {
    if (!workflowRun?.id) return;
    try {
      await pauseWorkflow.mutateAsync({ workflowRunId: workflowRun.id });
      toast.success("Workflow mis en pause");
    } catch {
      toast.error("Erreur lors de la pause");
    }
  };

  const handleResume = async () => {
    if (!workflowRun?.id) return;
    try {
      await resumeWorkflow.mutateAsync({ workflowRunId: workflowRun.id });
      toast.success("Workflow repris");
    } catch {
      toast.error("Erreur lors de la reprise");
    }
  };

  const handleCancel = async () => {
    if (!workflowRun?.id) return;
    try {
      await cancelWorkflow.mutateAsync({ workflowRunId: workflowRun.id, reason: "Cancelled by user" });
      toast.success("Workflow annulé");
    } catch {
      toast.error("Erreur lors de l'annulation");
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Zap className="h-8 w-8" /> Autopilot
        </h1>
        <div className="flex gap-2">
          {workflowRun?.status === "running" && (
            <Button variant="outline" onClick={handlePause} size="sm">
              <Pause className="h-4 w-4 mr-1" /> Pause
            </Button>
          )}
          {(workflowRun?.status === "paused" || workflowRun?.status === "failed") && (
            <Button variant="outline" onClick={handleResume} size="sm">
              <RotateCcw className="h-4 w-4 mr-1" /> Reprendre
            </Button>
          )}
          {workflowRun && workflowRun.status !== "completed" && workflowRun.status !== "cancelled" && (
            <Button variant="destructive" onClick={handleCancel} size="sm">
              <X className="h-4 w-4 mr-1" /> Annuler
            </Button>
          )}
        </div>
      </div>

      {/* Episode selector */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {episodes?.map(ep => (
          <Button
            key={ep.id}
            variant={activeEpisodeId === ep.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedEpisodeId(ep.id)}
          >
            Ep. {ep.number} — {ep.title}
            <Badge className="ml-2" variant={ep.status === "completed" ? "default" : "secondary"}>
              {ep.status}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Progress overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Progression pipeline</span>
            <Badge variant={workflowRun?.status === "running" ? "default" : "secondary"}>
              {workflowRun?.status || "Pas de workflow"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="h-3 mb-4" />
          <p className="text-sm text-muted-foreground">
            {completedSteps}/{totalSteps} étapes complétées ({progress.toFixed(0)}%)
          </p>

          {!workflowRun && activeEpisodeId && (
            <Button onClick={() => handleStart(activeEpisodeId)} className="mt-4" disabled={startAutopilot.isPending}>
              <Play className="h-4 w-4 mr-2" />
              {startAutopilot.isPending ? "Démarrage..." : "Démarrer l'autopilot"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Step timeline */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Timeline des étapes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(STEP_LABELS).map(([key, label], idx) => {
              const step = steps?.find(s => s.step_key === key);
              const status = step?.status || "pending";
              const confidence = confidenceScores?.find(s => s.dimension === key || s.dimension?.includes(key));

              return (
                <div key={key} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[status] || "bg-gray-300"}`} />
                  <span className="font-medium flex-1">{idx + 1}. {label}</span>

                  {confidence && (
                    <span className="text-sm text-muted-foreground">
                      Confiance: {(Number(confidence.score) * 100).toFixed(0)}%
                    </span>
                  )}

                  <Badge variant={
                    status === "completed" || status === "approved" ? "default" :
                    status === "waiting_approval" ? "destructive" :
                    status === "running" ? "secondary" : "outline"
                  }>
                    {status === "waiting_approval" ? "En attente d'approbation" :
                     status === "completed" ? "Terminé" :
                     status === "approved" ? "Approuvé" :
                     status === "running" ? "En cours" :
                     status === "failed" ? "Échoué" :
                     status === "rejected" ? "Rejeté" :
                     "En attente"}
                  </Badge>

                  {status === "waiting_approval" && (
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  )}
                  {(status === "completed" || status === "approved") && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  {status === "running" && (
                    <Clock className="h-4 w-4 text-blue-500 animate-spin" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Confidence scores */}
      {confidenceScores && confidenceScores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Scores de confiance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {confidenceScores.map(score => (
                <div key={score.id} className="p-3 border rounded-lg">
                  <p className="text-sm font-medium capitalize">{score.dimension?.replace(/_/g, " ")}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress value={Number(score.score) * 100} className="h-2 flex-1" />
                    <span className={`text-sm font-bold ${
                      Number(score.score) >= 0.85 ? "text-green-600" :
                      Number(score.score) >= 0.6 ? "text-yellow-600" : "text-red-600"
                    }`}>
                      {(Number(score.score) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
