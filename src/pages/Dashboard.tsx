import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Film, Music, Plus, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { OnboardingTour } from "@/components/OnboardingTour";
import { usePageTitle } from "@/hooks/usePageTitle";

const statusLabels: Record<string, string> = {
  draft: "Brouillon",
  analyzing: "Analyse…",
  planning: "Planification…",
  generating: "Génération…",
  stitching: "Assemblage…",
  completed: "Terminé",
  failed: "Échoué",
  cancelled: "Annulé",
};

const typeLabels: Record<string, string> = {
  clip: "Clip",
  film: "Film",
};

const styleLabels: Record<string, string> = {
  cinematic: "Cinématique",
  anime: "Anime",
  watercolor: "Aquarelle",
  "3d_render": "Rendu 3D",
  noir: "Noir",
  vintage: "Vintage",
  neon: "Néon",
  realistic: "Réaliste",
  hyperpop: "Hyperpop",
  afrofuturism: "Afrofuturisme",
  synthwave: "Synthwave",
  documentary: "Documentaire",
  fantasy: "Fantaisie",
};

const statusIcons: Record<string, React.ReactNode> = {
  draft: <Clock className="h-4 w-4" />,
  completed: <CheckCircle className="h-4 w-4 text-green-500" />,
  failed: <AlertCircle className="h-4 w-4 text-destructive" />,
  generating: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
  analyzing: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
  planning: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
  stitching: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
};

export default function Dashboard() {
  const { user } = useAuth();
  usePageTitle("Mes projets");

  const { data: projects, isLoading, isError, refetch } = useQuery({
    queryKey: ["projects", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return (
    <div className="min-h-screen bg-background">
      <OnboardingTour />
      <Navbar />
      <main className="container mx-auto px-4 py-10 md:py-14">
        <div className="mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Mes projets</h1>
            <p className="text-muted-foreground mt-1 text-sm">Retrouvez et gérez toutes vos créations vidéo</p>
          </div>
          <div className="flex gap-3">
            <Button variant="hero" size="sm" asChild>
              <Link to="/create/clip" className="gap-2">
                <Music className="h-4 w-4" /> Nouveau clip
              </Link>
            </Button>
            <Button variant="glass" size="sm" asChild>
              <Link to="/create/film" className="gap-2">
                <Film className="h-4 w-4" /> Nouveau film
              </Link>
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <Card className="border-destructive/50 bg-card/40">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <AlertCircle className="h-12 w-12 text-destructive/60" />
              <h3 className="text-lg font-medium">Impossible de charger vos projets</h3>
              <p className="text-muted-foreground text-sm text-center max-w-md">
                Une erreur est survenue lors du chargement. Vérifiez votre connexion et réessayez.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
                <Loader2 className="h-4 w-4" /> Réessayer
              </Button>
            </CardContent>
          </Card>
        ) : !projects?.length ? (
          <Card className="border-dashed border-border/50 bg-card/40">
            <CardContent className="flex flex-col items-center justify-center py-20 md:py-24">
              <Film className="h-16 w-16 text-muted-foreground/50 mb-5" />
              <h3 className="text-lg font-medium mb-2">Aucun projet pour le moment</h3>
              <p className="text-muted-foreground mb-8 text-center max-w-md text-sm">
                Créez votre première vidéo propulsée par l'IA
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="text-center">
                  <Button variant="hero" asChild>
                    <Link to="/create/clip"><Music className="h-4 w-4 mr-2" /> Créer un clip</Link>
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">À partir de votre musique</p>
                </div>
                <div className="text-center">
                  <Button variant="glass" asChild>
                    <Link to="/create/film"><Film className="h-4 w-4 mr-2" /> Créer un film</Link>
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">À partir d'un scénario</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link key={project.id} to={`/project/${project.id}`}>
                <Card className="border-border/50 bg-card/60 hover:bg-card/80 transition-all cursor-pointer group h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {project.type === "clip" ? <Music className="h-3 w-3 mr-1" /> : <Film className="h-3 w-3 mr-1" />}
                        {typeLabels[project.type] || project.type}
                      </Badge>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {statusIcons[project.status] || <Clock className="h-4 w-4" />}
                        {statusLabels[project.status] || project.status}
                      </div>
                    </div>
                    <CardTitle className="text-lg group-hover:text-primary transition-colors mt-2">
                      {project.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{styleLabels[project.style_preset || ""] || project.style_preset || "Pas de style"}</span>
                      <span>{project.duration_sec ? `${Math.round(project.duration_sec / 60)} min` : "—"}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
