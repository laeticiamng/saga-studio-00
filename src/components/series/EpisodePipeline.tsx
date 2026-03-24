import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAdvanceEpisode } from "@/hooks/useEpisodePipeline";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Play, CheckCircle, Circle, AlertCircle } from "lucide-react";

const STEPS = [
  { key: "draft", label: "Brouillon" },
  { key: "story_development", label: "Développement" },
  { key: "psychology_review", label: "Revue psy." },
  { key: "legal_ethics_review", label: "Revue légale" },
  { key: "visual_bible", label: "Bible visuelle" },
  { key: "continuity_check", label: "Continuité" },
  { key: "shot_generation", label: "Génération plans" },
  { key: "shot_review", label: "Revue plans" },
  { key: "assembly", label: "Assemblage" },
  { key: "edit_review", label: "Revue montage" },
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
  const { toast } = useToast();

  const currentIdx = STEPS.findIndex((s) => s.key === currentStatus);
  const canAdvance = currentStatus !== "draft" && currentStatus !== "completed" && currentStatus !== "failed" && currentStatus !== "cancelled";

  const handleAdvance = async () => {
    try {
      await advanceEpisode.mutateAsync({ episodeId });
      toast({ title: "Pipeline avancé avec succès" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur pipeline";
      toast({ title: message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {STEPS.map((step, idx) => {
          let icon = <Circle className="h-3 w-3" />;
          let variant: "default" | "secondary" | "outline" | "destructive" = "outline";

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
            } else {
              icon = <Loader2 className="h-3 w-3 animate-spin" />;
              variant = "default";
            }
          }

          return (
            <Badge key={step.key} variant={variant} className="gap-1">
              {icon}
              {step.label}
            </Badge>
          );
        })}
      </div>

      {canAdvance && (
        <Button
          onClick={handleAdvance}
          disabled={advanceEpisode.isPending}
          size="sm"
        >
          {advanceEpisode.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" />Exécution...</>
          ) : (
            <><Play className="h-4 w-4 mr-2" />Avancer le pipeline</>
          )}
        </Button>
      )}
    </div>
  );
}
