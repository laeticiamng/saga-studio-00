import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";

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
  episode: Tables<"episodes">;
  seriesId: string;
}) {
  const statusColor = statusColors[episode.status] || "bg-primary/10 text-primary";

  return (
    <Link to={`/series/${seriesId}/episode/${episode.id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">
                Épisode {episode.number}
              </p>
              <h4 className="font-medium truncate">{episode.title}</h4>
              {episode.synopsis && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {episode.synopsis}
                </p>
              )}
            </div>
            <Badge className={statusColor} variant="secondary">
              {statusLabels[episode.status] || episode.status}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
