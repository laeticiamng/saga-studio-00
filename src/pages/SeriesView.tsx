import { useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSeries } from "@/hooks/useSeries";
import { useSeasons, useCreateSeason } from "@/hooks/useSeasons";
import { useCharacterProfiles } from "@/hooks/useCharacterProfiles";
import { SeasonPanel } from "@/components/series/SeasonPanel";
import { BibleEditor } from "@/components/series/BibleEditor";
import { CharacterProfileCard } from "@/components/series/CharacterProfileCard";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Loader2, Tv, Plus, Users, BookOpen } from "lucide-react";

export default function SeriesView() {
  const { id } = useParams<{ id: string }>();
  const { data: series, isLoading } = useSeries(id);
  const { data: seasons } = useSeasons(id);
  const { data: characters } = useCharacterProfiles(id);
  const createSeason = useCreateSeason();

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

  const project = series.project as any;

  const handleAddSeason = async () => {
    const nextNumber = (seasons?.length ?? 0) + 1;
    await createSeason.mutateAsync({
      series_id: series.id,
      number: nextNumber,
      title: `Saison ${nextNumber}`,
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container max-w-6xl py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Tv className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{project?.title}</h1>
            <Badge variant="secondary">{series.genre || "Série"}</Badge>
            {series.tone && <Badge variant="outline">{series.tone}</Badge>}
          </div>
          {series.logline && (
            <p className="text-muted-foreground max-w-2xl">{series.logline}</p>
          )}
          {series.target_audience && (
            <p className="text-sm text-muted-foreground mt-1">
              Public: {series.target_audience}
            </p>
          )}
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
    </div>
  );
}
