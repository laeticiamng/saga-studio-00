import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { useDeleteEpisode } from "@/hooks/useEpisodes";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Episode = Database["public"]["Tables"]["episodes"]["Row"];

const statusLabels: Record<string, string> = {
  draft: "Brouillon",
  story_development: "Développement",
  psychology_review: "Revue psy.",
  legal_ethics_review: "Revue légale",
  visual_bible: "Bible visuelle",
  continuity_check: "Continuité",
  shot_generation: "Génération",
  shot_review: "Revue plans",
  assembly: "Assemblage",
  edit_review: "Revue montage",
  delivery: "Livraison",
  completed: "Terminé",
  failed: "Échoué",
  cancelled: "Annulé",
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-gray-100 text-gray-800",
};

export function EpisodeCard({
  episode,
  seriesId,
}: {
  episode: Episode;
  seriesId: string;
}) {
  const statusColor = statusColors[episode.status] || "bg-primary/10 text-primary";
  const deleteEpisode = useDeleteEpisode();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteEpisode.mutateAsync({ id: episode.id, seasonId: episode.season_id });
      toast.success("Épisode supprimé");
      setConfirmOpen(false);
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  return (
    <>
      <Link to={`/series/${seriesId}/episode/${episode.id}`}>
        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">
                  Épisode {episode.number}
                  {episode.duration_target_min && (
                    <span className="ml-2">• {episode.duration_target_min} min</span>
                  )}
                </p>
                <h4 className="font-medium truncate">{episode.title}</h4>
                {episode.synopsis && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {episode.synopsis}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge className={statusColor} variant="secondary">
                  {statusLabels[episode.status] || episode.status}
                </Badge>
                {episode.status === "draft" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    disabled={deleteEpisode.isPending}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmOpen(true); }}
                  >
                    {deleteEpisode.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Supprimer cet épisode ?"
        description="Cette action est irréversible."
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        isPending={deleteEpisode.isPending}
      />
    </>
  );
}
