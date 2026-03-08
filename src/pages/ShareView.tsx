import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Film, Download, Loader2 } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

const typeLabels: Record<string, string> = { clip: "Clip", film: "Film" };
const styleLabels: Record<string, string> = {
  cinematic: "Cinématique", anime: "Anime", watercolor: "Aquarelle",
  "3d_render": "Rendu 3D", noir: "Noir", vintage: "Vintage", neon: "Néon", realistic: "Réaliste",
  hyperpop: "Hyperpop", afrofuturism: "Afrofuturisme", synthwave: "Synthwave",
  documentary: "Documentaire", fantasy: "Fantaisie",
};

export default function ShareView() {
  const { id } = useParams<{ id: string }>();

  const { data: render, isLoading } = useQuery({
    queryKey: ["share-render", id],
    queryFn: async () => {
      const { data } = await supabase.from("renders").select("*").eq("project_id", id!).eq("status", "completed").maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: project } = useQuery({
    queryKey: ["share-project", id],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("title, type, style_preset, status").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!render || !project || project.status !== "completed") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-muted-foreground">
        <Film className="h-16 w-16 mb-4" />
        <p className="text-xl font-medium mb-2">Vidéo non disponible</p>
        <p className="text-sm mb-6">Cette vidéo n'existe pas ou n'a pas encore fini le rendu.</p>
        <Button variant="hero" asChild>
          <Link to="/">Aller sur CineClip AI</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-primary hover:opacity-80 transition-opacity mb-6">
            <Film className="h-5 w-5" />
            <span className="font-bold">CineClip AI</span>
          </Link>
          <h1 className="text-3xl font-bold mt-4">{project.title}</h1>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Badge variant="outline">{typeLabels[project.type] || project.type}</Badge>
            <Badge variant="secondary">{styleLabels[project.style_preset || ""] || project.style_preset}</Badge>
          </div>
        </div>

        {render.master_url_16_9 && (
          <div className="rounded-xl overflow-hidden bg-secondary/30 mb-6">
            <video src={render.master_url_16_9} controls className="w-full aspect-video" />
          </div>
        )}

        <Card className="border-border/50 bg-card/60">
          <CardHeader>
            <CardTitle className="text-lg">Télécharger</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {render.master_url_16_9 && (
              <a href={render.master_url_16_9} target="_blank" rel="noopener noreferrer">
                <Button variant="glass" className="w-full justify-start gap-2">
                  <Download className="h-4 w-4" /> Master 16:9
                </Button>
              </a>
            )}
            {render.master_url_9_16 && (
              <a href={render.master_url_9_16} target="_blank" rel="noopener noreferrer">
                <Button variant="glass" className="w-full justify-start gap-2 mt-2">
                  <Download className="h-4 w-4" /> Vertical 9:16
                </Button>
              </a>
            )}
            {render.teaser_url && (
              <a href={render.teaser_url} target="_blank" rel="noopener noreferrer">
                <Button variant="glass" className="w-full justify-start gap-2 mt-2">
                  <Download className="h-4 w-4" /> Teaser 15s
                </Button>
              </a>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Créé avec <Link to="/" className="text-primary hover:underline">CineClip AI</Link>
        </p>
      </div>
      <footer className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground mt-12">
        © {new Date().getFullYear()} CineClip AI. Tous droits réservés.
      </footer>
    </div>
  );
}
