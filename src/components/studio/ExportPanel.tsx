import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useCreateExportVersion } from "@/hooks/useExportVersions";
import { useToast } from "@/hooks/use-toast";
import { Download, Film, Monitor, Smartphone, Image, Clock, CheckCircle, Loader2, AlertCircle, ExternalLink, Zap } from "lucide-react";

const STATUS_MAP: Record<string, { label: string; icon: React.ElementType; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", icon: Clock, variant: "outline" },
  processing: { label: "En cours", icon: Loader2, variant: "secondary" },
  completed: { label: "Terminé", icon: CheckCircle, variant: "default" },
  failed: { label: "Échoué", icon: AlertCircle, variant: "destructive" },
};

interface ExportPanelProps {
  projectId: string;
  exports: Array<Record<string, unknown>>;
  timelineId: string | null;
}

export function ExportPanel({ projectId, exports: exportVersions, timelineId }: ExportPanelProps) {
  const createExport = useCreateExportVersion();
  const { toast } = useToast();
  const [renderingState, setRenderingState] = useState<"idle" | "invoking" | "rendering">("idle");
  const [renderProgress, setRenderProgress] = useState(0);

  // Subscribe to render table for progress
  useEffect(() => {
    if (renderingState !== "rendering") return;

    const channel = supabase
      .channel(`render-progress-${projectId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "renders",
        filter: `project_id=eq.${projectId}`,
      }, (payload) => {
        const row = payload.new as Record<string, unknown>;
        if (row.status === "completed") {
          setRenderingState("idle");
          setRenderProgress(100);
          toast({ title: "✅ Rendu terminé", description: "Votre export est prêt au téléchargement." });
        } else if (row.status === "failed") {
          setRenderingState("idle");
          setRenderProgress(0);
          toast({ title: "Erreur de rendu", variant: "destructive" });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [renderingState, projectId, toast]);

  const handleExport = async (format: string, resolution: string, aspect: string) => {
    try {
      // 1. Create export version row
      await createExport.mutateAsync({
        project_id: projectId,
        timeline_id: timelineId || undefined,
        format,
        resolution,
        aspect_ratio: aspect,
      });

      // 2. Invoke stitch-render edge function for actual rendering
      setRenderingState("invoking");
      setRenderProgress(10);

      const formatKeys = aspect === "9:16"
        ? ["master_9_16"]
        : aspect === "1:1"
          ? ["square"]
          : resolution === "720p"
            ? ["teaser"]
            : ["master_16_9"];

      const { data, error } = await supabase.functions.invoke("stitch-render", {
        body: { project_id: projectId, formats: formatKeys },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setRenderingState("rendering");
      setRenderProgress(50);

      toast({
        title: "Export lancé",
        description: `${resolution} ${aspect} — rendu ${data.render_mode === "server" ? "serveur" : "en cours"}`,
      });

      if (data.render_mode === "server" || data.success) {
        // Server render completed synchronously
        setRenderingState("idle");
        setRenderProgress(100);
      }
    } catch (err: unknown) {
      setRenderingState("idle");
      setRenderProgress(0);
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Erreur", variant: "destructive" });
    }
  };

  const isExporting = createExport.isPending || renderingState !== "idle";

  return (
    <div className="space-y-6">
      {/* Quick export buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" /> Exporter
          </CardTitle>
          <CardDescription>Créez un export final versionné. Le rendu est lancé automatiquement.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress bar during rendering */}
          {renderingState !== "idle" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-muted-foreground">
                  {renderingState === "invoking" ? "Lancement du rendu..." : "Rendu en cours..."}
                </span>
              </div>
              <Progress value={renderProgress} className="h-2" />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button variant="outline" className="justify-start gap-3 h-auto py-4" onClick={() => handleExport("mp4", "1080p", "16:9")}
              disabled={isExporting}>
              <Monitor className="h-5 w-5 text-primary shrink-0" />
              <div className="text-left">
                <p className="font-medium text-sm">Master 1080p 16:9</p>
                <p className="text-xs text-muted-foreground">Export principal HD</p>
              </div>
            </Button>
            <Button variant="outline" className="justify-start gap-3 h-auto py-4" onClick={() => handleExport("mp4", "720p", "16:9")}
              disabled={isExporting}>
              <Film className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="text-left">
                <p className="font-medium text-sm">Preview 720p</p>
                <p className="text-xs text-muted-foreground">Aperçu rapide</p>
              </div>
            </Button>
            <Button variant="outline" className="justify-start gap-3 h-auto py-4" onClick={() => handleExport("mp4", "1080p", "9:16")}
              disabled={isExporting}>
              <Smartphone className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="text-left">
                <p className="font-medium text-sm">Vertical 9:16</p>
                <p className="text-xs text-muted-foreground">TikTok / Reels / Shorts</p>
              </div>
            </Button>
            <Button variant="outline" className="justify-start gap-3 h-auto py-4" onClick={() => handleExport("png", "1080p", "16:9")}
              disabled={isExporting}>
              <Image className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="text-left">
                <p className="font-medium text-sm">Poster / Thumbnail</p>
                <p className="text-xs text-muted-foreground">Image de couverture</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Render status card */}
      <RenderStatusCard projectId={projectId} />

      {/* Export history */}
      {exportVersions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historique des exports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {exportVersions.map((exp) => {
              const status = String(exp.status);
              const config = STATUS_MAP[status] || STATUS_MAP.pending;
              const Icon = config.icon;
              return (
                <div key={String(exp.id)} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${status === "processing" ? "animate-spin" : ""}`} />
                    <div>
                      <span className="text-sm font-medium">
                        v{String(exp.version)} — {String(exp.resolution)} {String(exp.aspect_ratio)}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {String(exp.format).toUpperCase()}
                        {exp.look_preset && ` · ${String(exp.look_preset)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={config.variant}>{config.label}</Badge>
                    {exp.output_url && (
                      <a href={String(exp.output_url)} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost" className="gap-1">
                          <Download className="h-3.5 w-3.5" /> DL
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Sub-component: Show current render row status with download links
function RenderStatusCard({ projectId }: { projectId: string }) {
  const { data: render } = useQuery({
    queryKey: ["render_status", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("renders")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
      return data;
    },
  });

  if (!render) return null;

  const hasUrls = render.master_url_16_9 || render.master_url_9_16 || render.teaser_url || render.manifest_url;
  if (!hasUrls) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Rendus disponibles
          <Badge variant={render.status === "completed" ? "default" : "secondary"}>
            {render.render_mode === "server" ? "Serveur" : "Client"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {render.master_url_16_9 && (
          <a href={render.master_url_16_9} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-secondary/30 transition-colors">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Master 16:9</span>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        )}
        {render.master_url_9_16 && (
          <a href={render.master_url_9_16} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-secondary/30 transition-colors">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Vertical 9:16</span>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        )}
        {render.teaser_url && (
          <a href={render.teaser_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-secondary/30 transition-colors">
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Teaser</span>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        )}
        {render.manifest_url && !render.master_url_16_9 && (
          <div className="p-2.5 rounded-lg border bg-secondary/10">
            <p className="text-xs text-muted-foreground">
              Mode assemblage client — le manifest est prêt. Le rendu final sera effectué côté navigateur.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

