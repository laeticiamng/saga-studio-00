import { useParams } from "react-router-dom";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import Footer from "@/components/Footer";
import { useSeason } from "@/hooks/useSeasons";
import { useEpisodes, useCreateEpisode } from "@/hooks/useEpisodes";
import { useSeries } from "@/hooks/useSeries";
import { EpisodeCard } from "@/components/series/EpisodeCard";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Clock } from "lucide-react";

export default function SeasonView() {
  const { id: seriesId, seasonId } = useParams<{ id: string; seasonId: string }>();
  const { data: season, isLoading } = useSeason(seasonId);
  const { data: episodes } = useEpisodes(seasonId);
  const { data: series } = useSeries(seriesId);
  const createEpisode = useCreateEpisode();

  const [open, setOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSynopsis, setNewSynopsis] = useState("");
  const [newDuration, setNewDuration] = useState(String(series?.episode_duration_min || 50));

  usePageTitle(season ? `Saison ${season.number}` : "Saison");

  const totalDuration = episodes?.reduce((sum: number, ep: { duration_target_min?: number | null }) => sum + (ep.duration_target_min || 0), 0) || 0;
  const nextNumber = (episodes?.length || 0) + 1;

  const handleCreate = async () => {
    if (!newTitle.trim() || !seasonId) return;
    try {
      await createEpisode.mutateAsync({
        season_id: seasonId,
        number: nextNumber,
        title: newTitle.trim(),
        synopsis: newSynopsis.trim() || null,
        status: "draft",
        duration_target_min: Number(newDuration) || 50,
      });
      toast.success("Épisode créé");
      setOpen(false);
      setNewTitle("");
      setNewSynopsis("");
    } catch {
      toast.error("Erreur lors de la création");
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container max-w-4xl py-8">
        <Breadcrumbs items={[
          { label: "Mes projets", href: "/dashboard" },
          { label: String((series as Record<string, unknown>)?.project ? ((series as Record<string, unknown>).project as Record<string, unknown>)?.title || "Série" : "Série"), href: `/series/${seriesId}` },
          { label: `Saison ${season?.number || ""}` },
        ]} />
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">
            Saison {season?.number}{season?.title ? ` — ${season.title}` : ""}
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {totalDuration} min total
            </Badge>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Ajouter un épisode
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nouvel épisode</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Titre</Label>
                    <Input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder={`Épisode ${nextNumber}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Synopsis</Label>
                    <Textarea
                      value={newSynopsis}
                      onChange={(e) => setNewSynopsis(e.target.value)}
                      placeholder="Résumé de l'épisode..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Durée cible</Label>
                    <Select value={newDuration} onValueChange={setNewDuration}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 min</SelectItem>
                        <SelectItem value="10">10 min</SelectItem>
                        <SelectItem value="22">22 min</SelectItem>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="45">45 min</SelectItem>
                        <SelectItem value="50">50 min</SelectItem>
                        <SelectItem value="60">60 min</SelectItem>
                        <SelectItem value="90">90 min</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleCreate} disabled={createEpisode.isPending || !newTitle.trim()} className="w-full">
                    {createEpisode.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Créer l'épisode {nextNumber}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {season?.arc_summary && (
          <p className="text-muted-foreground mb-6">{season.arc_summary}</p>
        )}

        {/* Duration planning summary */}
        {episodes && episodes.length > 0 && (
          <Card className="mb-6">
            <CardContent className="py-3">
              <div className="flex items-center justify-between text-sm">
                <span>{episodes.length} épisodes × {series?.episode_duration_min || 50} min</span>
                <span className="font-medium">
                  ≈ {Math.ceil(totalDuration / 60)}h {totalDuration % 60}min de contenu
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {episodes && episodes.length > 0 ? (
            episodes.map((ep) => (
              <EpisodeCard key={ep.id} episode={ep} seriesId={seriesId!} />
            ))
          ) : (
            <p className="text-muted-foreground">Aucun épisode dans cette saison.</p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
