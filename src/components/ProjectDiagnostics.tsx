import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertTriangle, CheckCircle, XCircle, Image, Video, Server, Globe, Clock } from "lucide-react";

interface ProjectDiagnosticsProps {
  project: any;
  shots: any[] | null;
  render: any | null;
  plan: any | null;
  audioAnalysis: any | null;
}

const statusIcon = (status: string) => {
  switch (status) {
    case "completed": return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
    case "failed": return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    case "generating": case "analyzing": case "planning": case "stitching":
      return <Clock className="h-3.5 w-3.5 text-amber-500 animate-pulse" />;
    default: return <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
  }
};

const providerLabels: Record<string, string> = {
  openai_image: "OpenAI (Images)",
  sora: "OpenAI (Images)",
  runway: "Runway (Vidéo)",
  luma: "Luma (Vidéo)",
  mock: "Mock",
};

export function ProjectDiagnostics({ project, shots, render, plan, audioAnalysis }: ProjectDiagnosticsProps) {
  const completedShots = shots?.filter(s => s.status === "completed") || [];
  const failedShots = shots?.filter(s => s.status === "failed") || [];
  const generatingShots = shots?.filter(s => s.status === "generating") || [];
  const pendingShots = shots?.filter(s => s.status === "pending") || [];

  const imageShots = completedShots.filter(s => s.provider_type === "image" || s.provider === "sora" || s.provider === "openai_image");
  const videoShots = completedShots.filter(s => s.provider_type === "video" && s.provider !== "sora" && s.provider !== "openai_image");

  const renderMode = render?.render_mode || "none";
  const hasManifest = !!render?.manifest_url;
  const hasServerRender = renderMode === "server" && !!render?.master_url_16_9;

  // Parse render logs
  const renderLogs = render?.logs ? (() => { try { return JSON.parse(render.logs); } catch { return null; } })() : null;

  // Providers used
  const providersUsed = [...new Set(completedShots.map(s => s.provider).filter(Boolean))];

  return (
    <Card className="border-border/50 bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Diagnostic du projet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        {/* Pipeline Status */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-secondary/30 p-3 space-y-1">
            <span className="text-muted-foreground">Étape</span>
            <div className="flex items-center gap-1.5 font-medium">
              {statusIcon(project.status)}
              {project.status}
            </div>
          </div>
          <div className="rounded-lg bg-secondary/30 p-3 space-y-1">
            <span className="text-muted-foreground">Mode rendu</span>
            <div className="flex items-center gap-1.5 font-medium">
              {hasServerRender ? <Server className="h-3.5 w-3.5 text-green-500" /> : <Globe className="h-3.5 w-3.5 text-amber-500" />}
              {renderMode === "server" ? "Serveur" : renderMode === "client_assembly" ? "Navigateur" : "—"}
            </div>
          </div>
        </div>

        {/* Shots breakdown */}
        <div className="rounded-lg bg-secondary/30 p-3 space-y-2">
          <span className="text-muted-foreground font-medium">Shots</span>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium">{shots?.length || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-green-600"><CheckCircle className="h-3 w-3" /> Terminés</span>
              <span className="font-medium">{completedShots.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-amber-500"><Clock className="h-3 w-3" /> En cours</span>
              <span className="font-medium">{generatingShots.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-destructive"><XCircle className="h-3 w-3" /> Échoués</span>
              <span className="font-medium">{failedShots.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-muted-foreground">En attente</span>
              <span className="font-medium">{pendingShots.length}</span>
            </div>
          </div>

          {/* Provider type breakdown */}
          {completedShots.length > 0 && (
            <div className="border-t border-border/50 pt-2 mt-2 space-y-1">
              <span className="text-muted-foreground font-medium">Type de média</span>
              <div className="flex items-center gap-3">
                {imageShots.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Image className="h-3 w-3 text-blue-500" /> {imageShots.length} image(s)
                  </span>
                )}
                {videoShots.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Video className="h-3 w-3 text-green-500" /> {videoShots.length} vidéo(s)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Providers used */}
        {providersUsed.length > 0 && (
          <div className="rounded-lg bg-secondary/30 p-3 space-y-1.5">
            <span className="text-muted-foreground font-medium">Providers utilisés</span>
            <div className="flex flex-wrap gap-1.5">
              {providersUsed.map(p => (
                <Badge key={p} variant="outline" className="text-[10px]">
                  {providerLabels[p] || p}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Artifacts */}
        <div className="rounded-lg bg-secondary/30 p-3 space-y-1.5">
          <span className="text-muted-foreground font-medium">Artefacts</span>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span>Plan IA</span>
              {plan ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
            <div className="flex items-center justify-between">
              <span>Analyse audio</span>
              {audioAnalysis ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
            <div className="flex items-center justify-between">
              <span>Manifest</span>
              {hasManifest ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
            <div className="flex items-center justify-between">
              <span>Vidéo serveur</span>
              {hasServerRender ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
          </div>
        </div>

        {/* Last errors */}
        {failedShots.length > 0 && (
          <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 space-y-1.5">
            <span className="text-destructive font-medium flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Erreurs ({failedShots.length})
            </span>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {failedShots.slice(0, 5).map(s => (
                <p key={s.id} className="text-muted-foreground truncate">
                  Shot #{s.idx}: {s.error_message || "Erreur inconnue"}
                </p>
              ))}
              {failedShots.length > 5 && (
                <p className="text-muted-foreground italic">…et {failedShots.length - 5} autres</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
