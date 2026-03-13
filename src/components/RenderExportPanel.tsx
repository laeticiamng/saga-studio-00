import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Download, Film, Monitor, Smartphone, Square, Loader2, CheckCircle, Clapperboard, X } from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { renderVideo, type RenderProgress } from "@/lib/ffmpeg-renderer";

interface RenderExportPanelProps {
  projectId: string;
  render: any;
  projectStatus: string;
}

const FORMAT_OPTIONS = [
  { key: "master_16_9", label: "16:9 Paysage", icon: Monitor, description: "HD standard — YouTube, Vimeo (1920×1080)" },
  { key: "master_9_16", label: "9:16 Vertical", icon: Smartphone, description: "TikTok, Reels, Shorts (1080×1920)" },
  { key: "teaser", label: "Teaser 15s", icon: Film, description: "Extrait des meilleurs moments" },
  { key: "square", label: "1:1 Carré", icon: Square, description: "Feed Instagram (1080×1080)" },
];

export function RenderExportPanel({ projectId, render, projectStatus }: RenderExportPanelProps) {
  const { toast } = useToast();
  const [selectedFormats, setSelectedFormats] = useState<string[]>(["master_16_9", "master_9_16", "teaser"]);
  const [reRendering, setReRendering] = useState(false);
  const [clientRendering, setClientRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);
  const [renderedBlobUrl, setRenderedBlobUrl] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const toggleFormat = (key: string) => {
    setSelectedFormats(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleReRender = async () => {
    if (selectedFormats.length === 0) {
      toast({ title: "Sélectionnez des formats", description: "Choisissez au moins un format d'export", variant: "destructive" });
      return;
    }
    setReRendering(true);
    try {
      await supabase.functions.invoke("stitch-render", {
        body: { project_id: projectId, formats: selectedFormats },
      });
      toast({ title: "Rendu en cours", description: `Export de ${selectedFormats.length} format(s)…` });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setReRendering(false);
    }
  };

  const handleClientRender = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setClientRendering(true);
    setRenderProgress({ stage: "loading", percent: 0, message: "Initialisation…", etaSeconds: null, elapsedMs: 0 });
    setRenderedBlobUrl(null);

    try {
      // Fetch shots and manifest data
      const { data: shots } = await supabase
        .from("shots")
        .select("idx, output_url, duration_sec, status")
        .eq("project_id", projectId)
        .eq("status", "completed")
        .order("idx");

      const { data: project } = await supabase
        .from("projects")
        .select("audio_url")
        .eq("id", projectId)
        .single();

      if (!shots || shots.length === 0) {
        throw new Error("Aucun shot terminé trouvé");
      }

      // Resolve audio URL
      let audioUrl = project?.audio_url || null;
      if (audioUrl && !audioUrl.startsWith("http")) {
        const { data: urlData } = supabase.storage.from("audio-uploads").getPublicUrl(audioUrl);
        audioUrl = urlData?.publicUrl || null;
      }

      const shotInputs = shots.map(s => ({
        idx: s.idx,
        url: s.output_url || "",
        duration_sec: s.duration_sec || 5,
      }));

      const blob = await renderVideo(shotInputs, audioUrl, setRenderProgress, controller.signal);
      const url = URL.createObjectURL(blob);
      setRenderedBlobUrl(url);

      toast({ title: "Vidéo assemblée !", description: "Cliquez sur Télécharger pour récupérer le MP4" });
    } catch (err: any) {
      console.error("Client render error:", err);
      setRenderProgress({ stage: "error", percent: 0, message: err.message, etaSeconds: null, elapsedMs: 0 });
      toast({ title: "Erreur d'assemblage", description: err.message, variant: "destructive" });
    } finally {
      setClientRendering(false);
    }
  }, [projectId, toast]);

  const handleDownloadBlob = () => {
    if (!renderedBlobUrl) return;
    const a = document.createElement("a");
    a.href = renderedBlobUrl;
    a.download = `cineclip-export-${projectId.slice(0, 8)}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const renderLogs = render?.logs ? (() => { try { return JSON.parse(render.logs); } catch { return null; } })() : null;

  const isManifestUrl = (url?: string | null) => !!url && url.includes("manifest.json");
  const isManifestRender = isManifestUrl(render?.master_url_16_9);

  const downloadLinks = [
    { url: render?.master_url_16_9, label: "Master 16:9", icon: Monitor },
    { url: render?.master_url_9_16, label: "Vertical 9:16", icon: Smartphone },
    { url: render?.teaser_url, label: "Teaser 15s", icon: Film },
  ].filter((l) => l.url && !isManifestUrl(l.url));

  return (
    <Card className="border-primary/20 bg-card/60">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Download className="h-5 w-5 text-primary" /> Export & Téléchargements
          </CardTitle>
          {render && (
            <Badge variant={render.status === "completed" ? "default" : render.status === "failed" ? "destructive" : "secondary"}>
              {render.status === "completed" && <CheckCircle className="h-3 w-3 mr-1" />}
              {render.status === "processing" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {{ completed: "Terminé", pending: "En attente", processing: "En cours", failed: "Échoué" }[render.status as string] || render.status}
            </Badge>
          )}
        </div>
        <CardDescription className="text-sm">
          Assemblez vos shots en une vidéo MP4 directement dans votre navigateur grâce à FFmpeg.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Client-side FFmpeg Render */}
        {projectStatus === "completed" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Clapperboard className="h-5 w-5 text-primary" />
                <p className="text-sm font-semibold">Assemblage vidéo intégré</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Assemble tous les shots terminés avec l'audio en une vidéo MP4 — directement dans votre navigateur, sans serveur externe.
              </p>

              {renderProgress && clientRendering && (
                <div className="space-y-2">
                  <Progress value={renderProgress.percent} className="h-2" />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{renderProgress.message}</p>
                    {renderProgress.elapsedMs > 0 && (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {Math.round(renderProgress.elapsedMs / 1000)}s
                      </p>
                    )}
                  </div>
                  {renderProgress.stepIndex != null && renderProgress.stepTotal != null && (
                    <div className="flex gap-1">
                      {Array.from({ length: renderProgress.stepTotal }, (_, i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            i < renderProgress.stepIndex! ? "bg-primary" : i === renderProgress.stepIndex! ? "bg-primary/50 animate-pulse" : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {renderProgress?.stage === "error" && (
                <p className="text-xs text-destructive">{renderProgress.message}</p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="hero"
                  size="lg"
                  className="flex-1 gap-2"
                  onClick={handleClientRender}
                  disabled={clientRendering}
                >
                  {clientRendering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
                  {clientRendering ? "Assemblage en cours…" : "Assembler la vidéo"}
                </Button>

                {renderedBlobUrl && (
                  <Button
                    variant="default"
                    size="lg"
                    className="gap-2"
                    onClick={handleDownloadBlob}
                  >
                    <Download className="h-4 w-4" />
                    Télécharger MP4
                  </Button>
                )}
              </div>

              {renderedBlobUrl && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-2">Aperçu :</p>
                  <video
                    src={renderedBlobUrl}
                    controls
                    className="w-full rounded-lg border border-border/50"
                    style={{ maxHeight: 300 }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Format Selection for server-side re-render */}
        <details className="group">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors py-1">
            Options avancées (re-render serveur)
          </summary>
          <div className="mt-3 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FORMAT_OPTIONS.map(fmt => {
                const isSelected = selectedFormats.includes(fmt.key);
                return (
                  <label
                    key={fmt.key}
                    className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? "border-primary/50 bg-primary/5 shadow-sm"
                        : "border-border/50 bg-secondary/20 hover:bg-secondary/30 hover:border-border"
                    }`}
                  >
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleFormat(fmt.key)} />
                    <fmt.icon className={`h-5 w-5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{fmt.label}</p>
                      <p className="text-xs text-muted-foreground">{fmt.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="lg"
              className="w-full gap-2"
              onClick={handleReRender}
              disabled={reRendering || selectedFormats.length === 0}
            >
              {reRendering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
              {reRendering ? "Rendu en cours…" : `Re-render serveur (${selectedFormats.length} format(s))`}
            </Button>
          </div>
        </details>

        {/* Download Links (from server render) */}
        {render?.status === "completed" && !isManifestRender && downloadLinks.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Fichiers serveur</p>
            {downloadLinks.map((link) => (
              <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" className="block">
                <Button variant="glass" className="w-full justify-between gap-2 h-12">
                  <span className="flex items-center gap-2">
                    <link.icon className="h-4 w-4 text-primary" />
                    {link.label}
                  </span>
                  <Download className="h-4 w-4 text-muted-foreground" />
                </Button>
              </a>
            ))}
          </div>
        )}

        {/* Beat Sync Info */}
        {renderLogs?.beat_sync_enabled && (
          <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 space-y-1.5">
            <p className="text-sm font-medium flex items-center gap-2">🎵 Export synchronisé au rythme</p>
            <p className="text-xs text-muted-foreground">
              BPM : {renderLogs.bpm} · {renderLogs.cuts_count} coupes alignées sur les beats
            </p>
          </div>
        )}

        {/* Logs */}
        {render?.logs && (
          <details className="group">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors py-1">
              Voir les logs techniques
            </summary>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-secondary/30 rounded-lg p-4 mt-2 max-h-48 overflow-auto leading-relaxed">
              {typeof render.logs === "string" ? render.logs : JSON.stringify(render.logs, null, 2)}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
