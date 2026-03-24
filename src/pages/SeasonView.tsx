import { useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useSeason, useUpdateSeason } from "@/hooks/useSeasons";
import { useEpisodes } from "@/hooks/useEpisodes";
import { EpisodeCard } from "@/components/series/EpisodeCard";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Loader2 } from "lucide-react";

export default function SeasonView() {
  const { id: seriesId, seasonId } = useParams<{ id: string; seasonId: string }>();
  const { data: season, isLoading } = useSeason(seasonId);
  const { data: episodes } = useEpisodes(seasonId);

  usePageTitle(season ? `Saison ${season.number}` : "Saison");

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
        <h1 className="text-2xl font-bold mb-2">
          Saison {season?.number}{season?.title ? ` — ${season.title}` : ""}
        </h1>
        {season?.arc_summary && (
          <p className="text-muted-foreground mb-6">{season.arc_summary}</p>
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
