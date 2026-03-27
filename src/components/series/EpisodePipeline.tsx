import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAdvanceEpisode } from "@/hooks/useEpisodePipeline";
import { useStartAutopilot, useWorkflowRun, useConfidenceScores } from "@/hooks/useWorkflow";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Play, CheckCircle, Circle, AlertCircle, Zap, Clock } from "lucide-react";

const STEPS = [
  { key: "draft", label: "Brouillon" },
  { key: "story_development", label: "Développement" },
  { key: "psychology_review", label: "Revue psy.", gate: true },
  { key: "legal_ethics_review", label: "Revue légale", gate: true },
  { key: "visual_bible", label: "Bible visuelle" },
  { key: "continuity_check", label: "Continuité", gate: true },
  { key: "shot_generation", label: "Génération plans" },
  { key: "shot_review", label: "Revue plans", gate: true },
  { key: "assembly", label: "Assemblage" },
  { key: "edit_review", label: "Revue montage", gate: true },
  { key: "delivery", label: "Livraison" },
  { key: "completed", label: "Terminé" },
];

export function EpisodePipeline({
  episodeId,
  currentStatus,
}: {
  episodeId: string;
  currentStatus: string;
}) {
  const advanceEpisode = useAdvanceEpisode();
  const startAutopilot = useStartAutopilot();
  const { data: workflowRun } = useWorkflowRun(episodeId);
  const { data: confidenceScores } = useConfidenceScores(episodeId);
  const { toast } = useToast();

  const currentIdx = STEPS.findIndex((s) => s.key === currentStatus);
  const completedCount = Math.max(0, currentIdx);
  const totalPipelineSteps = STEPS.length - 2; // exclude draft and completed
  const progress = currentStatus === "completed" ? 100 : (completedCount / totalPipelineSteps) * 100;

  const canAdvance = currentStatus !== "draft" && currentStatus !== "completed" && currentStatus !== "failed" && currentStatus !== "cancelled";
  const canStartAutopilot = currentStatus === "draft";

  const handleAdvance = async () => {
    try {
      await advanceEpisode.mutateAsync({ episodeId });
      toast({ title: "Pipeline avancé avec succès" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur pipeline";
      toast({ title: message, variant: "destructive" });
    }
  };

  const handleStartAutopilot = async () => {
    try {
      await startAutopilot.mutateAsync({ episodeId });
      toast({ title: "Autopilot démarré avec succès" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur au démarrage";
      toast({ title: message, variant: "destructive" });
    }
  };

  const getConfidence = (stepKey: string) => {
    return confidenceScores?.find((s: any) => s.dimension === stepKey || s.dimension?.includes(stepKey));
  };

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <Progress value={progress} className="h-2 flex-1" />
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
          {progress.toFixed(0)}%
        </span>
      </div>

      {/* Step badges */}
      <div className="flex flex-wrap gap-2">
        {STEPS.map((step, idx) => {
          let icon = <Circle className="h-3 w-3" />;
          let variant: "default" | "secondary" | "outline" | "destructive" = "outline";
          const confidence = getConfidence(step.key);

          if (idx < currentIdx) {
            icon = <CheckCircle className="h-3 w-3" />;
            variant = "secondary";
          } else if (idx === currentIdx) {
            if (currentStatus === "completed") {
              icon = <CheckCircle className="h-3 w-3" />;
              variant = "default";
            } else if (currentStatus === "failed") {
              icon = <AlertCircle className="h-3 w-3" />;
              variant = "destructive";
            } else if (currentStatus === "draft") {
              icon = <Circle className="h-3 w-3" />;
              variant = "outline";
            } else {
              icon = <Loader2 className="h-3 w-3 animate-spin" />;
              variant = "default";
            }
          }

          return (
            <div key={step.key} className="flex flex-col items-center gap-0.5">
              <Badge variant={variant} className="gap-1">
                {icon}
                {step.label}
                {step.gate && <Clock className="h-2.5 w-2.5 ml-0.5 opacity-60" />}
              </Badge>
              {confidence && idx <= currentIdx && (
                <span className={`text-[10px] font-medium ${
                  Number(confidence.score) >= 0.85 ? "text-green-600" :
                  Number(confidence.score) >= 0.6 ? "text-yellow-600" : "text-red-600"
                }`}>
                  {(Number(confidence.score) * 100).toFixed(0)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {canStartAutopilot && (
          <Button
            onClick={handleStartAutopilot}
            disabled={startAutopilot.isPending}
            size="sm"
          >
            {startAutopilot.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Démarrage...</>
            ) : (
              <><Zap className="h-4 w-4 mr-2" />Lancer l'autopilot</>
            )}
          </Button>
        )}

        {canAdvance && (
          <Button
            onClick={handleAdvance}
            disabled={advanceEpisode.isPending}
            size="sm"
            variant="outline"
          >
            {advanceEpisode.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Exécution...</>
            ) : (
              <><Play className="h-4 w-4 mr-2" />Avancer manuellement</>
            )}
          </Button>
        )}

        {workflowRun && (
          <Badge variant="secondary" className="self-center">
            Workflow: {workflowRun.status}
          </Badge>
        )}
      </div>
    </div>
  );
}
