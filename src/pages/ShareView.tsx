import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Film, Download, Loader2, Play } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { ShotPreviewPlayer } from "@/components/ShotPreviewPlayer";
import { useSignedRenderUrl } from "@/hooks/useSignedRenderUrl";

import { typeLabels, styleLabels } from "@/lib/labels";

function isManifestUrl(url: string | null): boolean {
  return !!url && url.includes("manifest.json");
}

export default function ShareView() {
  const { id } = useParams<{ id: string }>();
  usePageTitle("Partage vidéo");

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
      const { data } = await supabase.from("projects_public").select("title, type, style_preset, status").eq("id", id!).maybeSingle();
      return data as { title: string; type: string; style_preset: string | null; status: string } | null;
    },
    enabled: !!id,
  });

  // Resolve signed URLs for the new private bucket (paths) — fallback to legacy public URLs
  const master16 = useSignedRenderUrl({
    path: render?.master_path_16_9 ?? null,
    projectId: id,
    fallbackUrl: render?.master_url_16_9 ?? null,
    mode: "public",
  });
  const master9 = useSignedRenderUrl({
    path: render?.master_path_9_16 ?? null,
    projectId: id,
    fallbackUrl: render?.master_url_9_16 ?? null,
    mode: "public",
  });
  const teaser = useSignedRenderUrl({
    path: render?.teaser_path ?? null,
    projectId: id,
    fallbackUrl: render?.teaser_url ?? null,
    mode: "public",
  });
  const manifest = useSignedRenderUrl({
    path: render?.manifest_path ?? null,
    projectId: id,
    fallbackUrl: render?.manifest_url ?? null,
    mode: "public",
  });

  // For manifest-based renders, load shots for the player
  const isManifest = render?.render_mode === "client_assembly" || isManifestUrl(render?.master_url_16_9 ?? null);

  const { data: shots } = useQuery({
    queryKey: ["share-shots", id],
    queryFn: async () => {
      const { data } = await supabase.from("shots").select("id, idx, status, output_url, duration_sec, prompt").eq("project_id", id!).eq("status", "completed").order("idx");
      return data || [];
    },
    enabled: !!id && isManifest,
  });

  const { data: audioAnalysis } = useQuery({
    queryKey: ["share-audio", id],
    queryFn: async () => {
      const { data } = await supabase.from("audio_analysis").select("bpm").eq("project_id", id!).maybeSingle();
      return data;
    },
    enabled: !!id && isManifest,
  });

  // Fetch manifest contents (uses signed URL if available)
  const { data: manifestData } = useQuery({
    queryKey: ["share-manifest-data", manifest.url],
    queryFn: async () => {
      const res = await fetch(manifest.url!);
      return res.json();
    },
    enabled: !!manifest.url && isManifest,
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
          <Link to="/">Aller sur Saga Studio</Link>
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
            <span className="font-bold">Saga Studio</span>
          </Link>
          <h1 className="text-3xl font-bold mt-4">{project.title}</h1>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Badge variant="outline">{typeLabels[project.type] || project.type}</Badge>
            <Badge variant="secondary">{styleLabels[project.style_preset || ""] || project.style_preset}</Badge>
          </div>
        </div>

        {/* Manifest-based render: use the interactive player */}
        {isManifest && shots && shots.length > 0 ? (
          <div className="mb-6">
            <ShotPreviewPlayer
              shots={shots}
              audioUrl={manifestData?.audio_url}
              bpm={audioAnalysis?.bpm || manifestData?.bpm}
            />
            <div className="mt-3 text-center">
              <Badge variant="secondary" className="gap-1">
                <Play className="h-3 w-3" /> Lecteur interactif — {shots.length} plans synchronisés
              </Badge>
            </div>
          </div>
        ) : master16.url && !isManifest ? (
          <div className="rounded-xl overflow-hidden bg-secondary/30 mb-6">
            <video src={master16.url} controls className="w-full aspect-video" />
          </div>
        ) : master16.isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : null}

        {/* Download section - only for non-manifest renders */}
        {!isManifest && (
          <Card className="border-border/50 bg-card/60">
            <CardHeader>
              <CardTitle className="text-lg">Télécharger</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {master16.url && (
                <a href={master16.url} target="_blank" rel="noopener noreferrer">
                  <Button variant="glass" className="w-full justify-start gap-2">
                    <Download className="h-4 w-4" /> Master 16:9
                  </Button>
                </a>
              )}
              {master9.url && master9.url !== master16.url && (
                <a href={master9.url} target="_blank" rel="noopener noreferrer">
                  <Button variant="glass" className="w-full justify-start gap-2 mt-2">
                    <Download className="h-4 w-4" /> Vertical 9:16
                  </Button>
                </a>
              )}
              {teaser.url && (
                <a href={teaser.url} target="_blank" rel="noopener noreferrer">
                  <Button variant="glass" className="w-full justify-start gap-2 mt-2">
                    <Download className="h-4 w-4" /> Teaser
                  </Button>
                </a>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      <footer className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground mt-12">
        © {new Date().getFullYear()} EMOTIONSCARE SASU — Saga Studio. Tous droits réservés.
      </footer>
    </div>
  );
}
