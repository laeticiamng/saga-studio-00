import { useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import Footer from "@/components/Footer";
import { useCharacterProfiles } from "@/hooks/useCharacterProfiles";
import { CharacterProfileCard } from "@/components/series/CharacterProfileCard";
import { useSeries } from "@/hooks/useSeries";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Loader2 } from "lucide-react";
import { getSeriesProjectTitle } from "@/lib/series-helpers";

export default function CharacterGallery() {
  const { id } = useParams<{ id: string }>();
  const { data: series } = useSeries(id);
  const { data: characters, isLoading } = useCharacterProfiles(id);
  usePageTitle("Personnages");

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
      <main className="flex-1 container max-w-5xl py-8">
        <Breadcrumbs items={[
          { label: "Mes projets", href: "/dashboard" },
          { label: getSeriesProjectTitle(series), href: `/series/${id}` },
          { label: "Personnages" },
        ]} />
        <h1 className="text-2xl font-bold mb-6">Personnages</h1>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {characters && characters.length > 0 ? (
            characters.map((char) => (
              <CharacterProfileCard key={char.id} character={char} />
            ))
          ) : (
            <p className="text-muted-foreground col-span-full">
              Aucun personnage créé.
            </p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
