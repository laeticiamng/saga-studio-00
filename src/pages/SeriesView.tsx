import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSeries, useDeleteSeries } from "@/hooks/useSeries";
import { useSeasons, useCreateSeason } from "@/hooks/useSeasons";
import { useCharacterProfiles } from "@/hooks/useCharacterProfiles";
import { SeasonPanel } from "@/components/series/SeasonPanel";
import { BibleEditor } from "@/components/series/BibleEditor";
import { CharacterProfileCard } from "@/components/series/CharacterProfileCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { usePageTitle } from "@/hooks/usePageTitle";
import { toast } from "sonner";
import { Loader2, Tv, Plus, Users, BookOpen, Zap, Shield, Network, Package, Bot, ClipboardList, Trash2 } from "lucide-react";

export default function SeriesView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: series, isLoading } = useSeries(id);
  const { data: seasons } = useSeasons(id);
  const { data: characters } = useCharacterProfiles(id);
  const createSeason = useCreateSeason();
  const deleteSeries = useDeleteSeries();
  const [confirmOpen, setConfirmOpen] = useState(false);

  usePageTitle(series?.project?.title || "Série");

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

  if (!series) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Série non trouvée</p>
        </main>
      </div>
    );
  }

  const project = series.project as Record<string, unknown> | undefined;

  const handleAddSeason = async () => {
    const nextNumber = (seasons?.length ?? 0) + 1;
    await createSeason.mutateAsync({
      series_id: series.id,
      number: nextNumber,
      title: `Saison ${nextNumber}`,
    });
  };

  const handleDeleteSeries = async () => {
    try {
      await deleteSeries.mutateAsync(id!);
      toast.success("Série supprimée");
      setConfirmOpen(false);
      navigate("/dashboard");
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container max-w-6xl py-8">
        <Breadcrumbs items={[
          { label: "Mes projets", href: "/dashboard" },
          { label: String(project?.title || "Série") },
        ]} />
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Tv className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{String(project?.title || "Série")}</h1>
            <Badge variant="secondary">{series.genre || "Série"}</Badge>
            {series.tone && <Badge variant="outline">{series.tone}</Badge>}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-muted-foreground hover:text-destructive"
              disabled={deleteSeries.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              {deleteSeries.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Supprimer
            </Button>
          </div>
          {series.logline && (
            <p className="text-muted-foreground max-w-2xl">{series.logline}</p>
          )}
          {series.target_audience && (
            <p className="text-sm text-muted-foreground mt-1">
              Public: {series.target_audience}
            </p>
          )}
          {/* Quick nav to studio tools */}
          <div className="flex gap-2 mt-4 flex-wrap">
            <Button variant="outline" size="sm" asChild>
              <Link to={`/series/${id}/autopilot`}><Zap className="h-4 w-4 mr-1" />Autopilot</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/series/${id}/approvals`}><Shield className="h-4 w-4 mr-1" />Approbations</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/series/${id}/continuity`}><Network className="h-4 w-4 mr-1" />Continuité</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/series/${id}/delivery`}><Package className="h-4 w-4 mr-1" />Livraison</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/series/${id}/agents`}><Bot className="h-4 w-4 mr-1" />Agents</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/series/${id}/documents`}><ClipboardList className="h-4 w-4 mr-1" />Documents</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/series/${id}/bibles`}><BookOpen className="h-4 w-4 mr-1" />Bibles</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/series/${id}/characters`}><Users className="h-4 w-4 mr-1" />Personnages</Link>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="episodes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="episodes">Épisodes</TabsTrigger>
            <TabsTrigger value="bibles">
              <BookOpen className="h-4 w-4 mr-1" />Bibles
            </TabsTrigger>
            <TabsTrigger value="characters">
              <Users className="h-4 w-4 mr-1" />Personnages
            </TabsTrigger>
          </TabsList>

          <TabsContent value="episodes" className="space-y-4">
            {seasons && seasons.length > 0 ? (
              seasons.map((season) => (
                <SeasonPanel
                  key={season.id}
                  season={season}
                  seriesId={series.id}
                />
              ))
            ) : (
              <p className="text-muted-foreground">Aucune saison</p>
            )}
            <Button
              variant="outline"
              onClick={handleAddSeason}
              disabled={createSeason.isPending}
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une saison
            </Button>
          </TabsContent>

          <TabsContent value="bibles">
            <BibleEditor seriesId={series.id} />
          </TabsContent>

          <TabsContent value="characters">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {characters && characters.length > 0 ? (
                characters.map((char) => (
                  <CharacterProfileCard key={char.id} character={char} />
                ))
              ) : (
                <p className="text-muted-foreground col-span-full">
                  Aucun personnage. Les agents les créeront lors du développement narratif.
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Supprimer cette série ?"
        description="Tous les contenus (saisons, épisodes, bibles, personnages) seront définitivement supprimés."
        confirmLabel="Supprimer"
        onConfirm={handleDeleteSeries}
        isPending={deleteSeries.isPending}
      />
    </div>
  );
}
