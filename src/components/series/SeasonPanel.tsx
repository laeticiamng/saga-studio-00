import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EpisodeCard } from "./EpisodeCard";
import { useEpisodes, useCreateEpisode } from "@/hooks/useEpisodes";
import { useDeleteSeason } from "@/hooks/useSeasons";
import { toast } from "sonner";
import { Plus, Loader2, Trash2 } from "lucide-react";

export function SeasonPanel({
  season,
  seriesId,
}: {
  season: any;
  seriesId: string;
}) {
  const { data: episodes, isLoading } = useEpisodes(season.id);
  const createEpisode = useCreateEpisode();
  const deleteSeason = useDeleteSeason();
  const [newTitle, setNewTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleDeleteSeason = async () => {
    if (!confirm("Supprimer cette saison et tous ses épisodes ?")) return;
    try {
      await deleteSeason.mutateAsync({ id: season.id, seriesId });
      toast.success("Saison supprimée");
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleAddEpisode = async () => {
    if (!newTitle.trim()) return;
    const nextNumber = (episodes?.length ?? 0) + 1;
    await createEpisode.mutateAsync({
      season_id: season.id,
      number: nextNumber,
      title: newTitle.trim(),
    });
    setNewTitle("");
    setIsAdding(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            Saison {season.number}{season.title ? ` — ${season.title}` : ""}
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={handleDeleteSeason}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        {season.arc_summary && (
          <p className="text-sm text-muted-foreground">{season.arc_summary}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : episodes && episodes.length > 0 ? (
          episodes.map((ep) => (
            <EpisodeCard key={ep.id} episode={ep} seriesId={seriesId} />
          ))
        ) : (
          <p className="text-sm text-muted-foreground py-2">Aucun épisode</p>
        )}

        {isAdding ? (
          <div className="flex gap-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Titre de l'épisode"
              onKeyDown={(e) => e.key === "Enter" && handleAddEpisode()}
              autoFocus
            />
            <Button size="sm" onClick={handleAddEpisode} disabled={createEpisode.isPending}>
              {createEpisode.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ajouter"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>
              Annuler
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsAdding(true)}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-1" />
            Ajouter un épisode
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
