import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateSeries } from "@/hooks/useSeries";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Loader2, Tv } from "lucide-react";

const GENRES = [
  "Drame", "Thriller", "Comédie", "Science-Fiction", "Fantaisie",
  "Horreur", "Romance", "Action", "Documentaire", "Animation",
];

const TONES = [
  "Sombre", "Lumineux", "Satirique", "Mélancolique", "Épique",
  "Intimiste", "Suspense", "Onirique", "Réaliste", "Poétique",
];

const STYLES = [
  { value: "cinematic", label: "Cinématique" },
  { value: "anime", label: "Anime" },
  { value: "watercolor", label: "Aquarelle" },
  { value: "3d_render", label: "Rendu 3D" },
  { value: "noir", label: "Noir" },
  { value: "vintage", label: "Vintage" },
  { value: "neon", label: "Néon" },
  { value: "realistic", label: "Réaliste" },
  { value: "documentary", label: "Documentaire" },
  { value: "fantasy", label: "Fantaisie" },
];

export default function CreateSeries() {
  usePageTitle("Créer une série");
  const navigate = useNavigate();
  const { toast } = useToast();
  const createSeries = useCreateSeries();

  const [title, setTitle] = useState("");
  const [logline, setLogline] = useState("");
  const [genre, setGenre] = useState("");
  const [tone, setTone] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [totalSeasons, setTotalSeasons] = useState(1);
  const [episodeDuration, setEpisodeDuration] = useState(50);
  const [stylePreset, setStylePreset] = useState("");
  const [episodesPerSeason, setEpisodesPerSeason] = useState(10);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: "Titre requis", variant: "destructive" });
      return;
    }

    try {
      const result = await createSeries.mutateAsync({
        title: title.trim(),
        logline: logline.trim() || undefined,
        genre: genre || undefined,
        tone: tone || undefined,
        target_audience: targetAudience.trim() || undefined,
        total_seasons: totalSeasons,
        style_preset: stylePreset || undefined,
        episode_duration_min: episodeDuration,
        episodes_per_season: episodesPerSeason,
      });
      toast({ title: "Série créée avec succès" });
      navigate(`/series/${result.series.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de la création";
      toast({ title: message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container max-w-2xl py-10">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tv className="h-5 w-5" />
              Créer une série
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Titre *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Le titre de votre série"
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="logline">Logline</Label>
                <Textarea
                  id="logline"
                  value={logline}
                  onChange={(e) => setLogline(e.target.value)}
                  placeholder="Une phrase qui résume le concept de la série"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Genre</Label>
                  <Select value={genre} onValueChange={setGenre}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENRES.map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Ton</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {TONES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Style visuel</Label>
                <Select value={stylePreset} onValueChange={setStylePreset}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un style" />
                  </SelectTrigger>
                  <SelectContent>
                    {STYLES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="audience">Public cible</Label>
                <Input
                  id="audience"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="Ex: Adultes 25-45 ans, amateurs de thriller"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="seasons">Saisons prévues</Label>
                  <Input
                    id="seasons"
                    type="number"
                    min={1}
                    max={20}
                    value={totalSeasons}
                    onChange={(e) => setTotalSeasons(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="epDuration">Durée épisode (min)</Label>
                  <Select value={String(episodeDuration)} onValueChange={(v) => setEpisodeDuration(Number(v))}>
                    <SelectTrigger id="epDuration">
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

                <div className="space-y-2">
                  <Label htmlFor="epCount">Épisodes/saison</Label>
                  <Input
                    id="epCount"
                    type="number"
                    min={1}
                    max={50}
                    value={episodesPerSeason}
                    onChange={(e) => setEpisodesPerSeason(Number(e.target.value))}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={createSeries.isPending}
              >
                {createSeries.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Création en cours...</>
                ) : (
                  "Créer la série"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
