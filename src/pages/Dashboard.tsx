import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Film, Music, Plus, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { OnboardingTour } from "@/components/OnboardingTour";

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

  const { data: projects, isLoading } = useQuery({
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
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Mes projets</h1>
          <div className="flex gap-3">
            <Button variant="hero" asChild>
              <Link to="/create/clip" className="gap-2">
                <Music className="h-4 w-4" /> Nouveau clip
              </Link>
            </Button>
            <Button variant="glass" asChild>
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
        ) : !projects?.length ? (
          <Card className="border-dashed border-border/50 bg-card/40">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <Film className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Aucun projet pour le moment</h3>
              <p className="text-muted-foreground mb-6">Créez votre première vidéo propulsée par l'IA</p>
              <div className="flex gap-3">
                <Button variant="hero" asChild>
                  <Link to="/create/clip"><Music className="h-4 w-4 mr-2" /> Générer un clip</Link>
                </Button>
                <Button variant="glass" asChild>
                  <Link to="/create/film"><Film className="h-4 w-4 mr-2" /> Générer un film</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link key={project.id} to={`/project/${project.id}`}>
                <Card className="border-border/50 bg-card/60 hover:bg-card/80 transition-all cursor-pointer group">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {project.type === "clip" ? <Music className="h-3 w-3 mr-1" /> : <Film className="h-3 w-3 mr-1" />}
                        {project.type}
                      </Badge>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {statusIcons[project.status] || <Clock className="h-4 w-4" />}
                        {statusLabels[project.status] || project.status}
                      </div>
                    </div>
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">
                      {project.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{project.style_preset || "Pas de style"}</span>
                      <span>{project.duration_sec ? `${Math.round(project.duration_sec / 60)} min` : "—"}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
