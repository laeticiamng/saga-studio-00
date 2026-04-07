import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCreateExportVersion } from "@/hooks/useExportVersions";
import { useToast } from "@/hooks/use-toast";
import { Download, Film, Monitor, Smartphone, Image, Clock, CheckCircle, Loader2, AlertCircle } from "lucide-react";

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

  const handleExport = async (format: string, resolution: string, aspect: string) => {
    try {
      await createExport.mutateAsync({
        project_id: projectId,
        timeline_id: timelineId || undefined,
        format,
        resolution,
        aspect_ratio: aspect,
      });
      toast({ title: "Export lancé", description: `${resolution} ${aspect} — en cours de traitement` });
    } catch (err: unknown) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Erreur", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick export buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" /> Exporter
          </CardTitle>
          <CardDescription>Créez un export final versionné de votre projet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button variant="outline" className="justify-start gap-3 h-auto py-4" onClick={() => handleExport("mp4", "1080p", "16:9")}
              disabled={createExport.isPending}>
              <Monitor className="h-5 w-5 text-primary shrink-0" />
              <div className="text-left">
                <p className="font-medium text-sm">Master 1080p 16:9</p>
                <p className="text-xs text-muted-foreground">Export principal HD</p>
              </div>
            </Button>
            <Button variant="outline" className="justify-start gap-3 h-auto py-4" onClick={() => handleExport("mp4", "720p", "16:9")}
              disabled={createExport.isPending}>
              <Film className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="text-left">
                <p className="font-medium text-sm">Preview 720p</p>
                <p className="text-xs text-muted-foreground">Aperçu rapide</p>
              </div>
            </Button>
            <Button variant="outline" className="justify-start gap-3 h-auto py-4" onClick={() => handleExport("mp4", "1080p", "9:16")}
              disabled={createExport.isPending}>
              <Smartphone className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="text-left">
                <p className="font-medium text-sm">Vertical 9:16</p>
                <p className="text-xs text-muted-foreground">TikTok / Reels / Shorts</p>
              </div>
            </Button>
            <Button variant="outline" className="justify-start gap-3 h-auto py-4" onClick={() => handleExport("png", "1080p", "16:9")}
              disabled={createExport.isPending}>
              <Image className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="text-left">
                <p className="font-medium text-sm">Poster / Thumbnail</p>
                <p className="text-xs text-muted-foreground">Image de couverture</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

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
