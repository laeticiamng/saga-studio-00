import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Film, Monitor, Smartphone, Square, Loader2, CheckCircle } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
          {isManifestRender
            ? "Le rendu actuel est en mode lecteur interactif (manifest JSON). Aucun fichier MP4 n'est disponible au téléchargement pour le moment."
            : "Choisissez les formats souhaités et lancez l'export. Vous pourrez télécharger chaque version ci-dessous."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Format Selection */}
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
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleFormat(fmt.key)}
                />
                <fmt.icon className={`h-5 w-5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{fmt.label}</p>
                  <p className="text-xs text-muted-foreground">{fmt.description}</p>
                </div>
              </label>
            );
          })}
        </div>

        {/* Export Button */}
        {projectStatus === "completed" && (
          <Button
            variant="hero"
            size="lg"
            className="w-full gap-2"
            onClick={handleReRender}
            disabled={reRendering || selectedFormats.length === 0}
          >
            {reRendering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
            {reRendering ? "Rendu en cours…" : `Exporter ${selectedFormats.length} format(s)`}
          </Button>
        )}

        {/* Download Links */}
        {render?.status === "completed" && downloadLinks.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Fichiers prêts</p>
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
            {renderLogs.transitions && (
              <p className="text-xs text-muted-foreground">Transitions : {renderLogs.transitions.join(", ")}</p>
            )}
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
