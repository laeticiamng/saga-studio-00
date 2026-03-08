import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Film, Monitor, Smartphone, Square, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RenderExportPanelProps {
  projectId: string;
  render: any;
  projectStatus: string;
}

const FORMAT_OPTIONS = [
  { key: "master_16_9", label: "16:9 Landscape", icon: Monitor, description: "Standard HD (1920×1080)" },
  { key: "master_9_16", label: "9:16 Vertical", icon: Smartphone, description: "TikTok / Reels (1080×1920)" },
  { key: "teaser", label: "15s Teaser", icon: Film, description: "Best section highlight" },
  { key: "square", label: "1:1 Square", icon: Square, description: "Instagram feed (1080×1080)" },
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
      toast({ title: "Select formats", description: "Choose at least one export format", variant: "destructive" });
      return;
    }
    setReRendering(true);
    try {
      await supabase.functions.invoke("stitch-render", {
        body: { project_id: projectId, formats: selectedFormats },
      });
      toast({ title: "Re-rendering", description: `Exporting ${selectedFormats.length} format(s)...` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setReRendering(false);
    }
  };

  const renderLogs = render?.logs ? (() => { try { return JSON.parse(render.logs); } catch { return null; } })() : null;

  return (
    <Card className="border-primary/30 bg-card/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" /> Export & Downloads
          {render && (
            <Badge variant={render.status === "completed" ? "secondary" : "outline"} className="ml-2 capitalize">
              {render.status}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Format selector */}
        <div className="grid grid-cols-2 gap-2">
          {FORMAT_OPTIONS.map(fmt => (
            <label
              key={fmt.key}
              className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                selectedFormats.includes(fmt.key)
                  ? "border-primary bg-primary/5"
                  : "border-border/50 bg-secondary/20 hover:bg-secondary/30"
              }`}
            >
              <Checkbox
                checked={selectedFormats.includes(fmt.key)}
                onCheckedChange={() => toggleFormat(fmt.key)}
              />
              <fmt.icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{fmt.label}</p>
                <p className="text-xs text-muted-foreground">{fmt.description}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Re-render button */}
        {projectStatus === "completed" && (
          <Button
            variant="hero"
            className="w-full gap-2"
            onClick={handleReRender}
            disabled={reRendering || selectedFormats.length === 0}
          >
            {reRendering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
            {reRendering ? "Rendering..." : `Export ${selectedFormats.length} format(s)`}
          </Button>
        )}

        {/* Download links */}
        {render?.status === "completed" && (
          <div className="space-y-2">
            {render.master_url_16_9 && (
              <a href={render.master_url_16_9} target="_blank" rel="noopener noreferrer">
                <Button variant="glass" className="w-full justify-start gap-2">
                  <Download className="h-4 w-4" /> Download 16:9 Master
                </Button>
              </a>
            )}
            {render.master_url_9_16 && (
              <a href={render.master_url_9_16} target="_blank" rel="noopener noreferrer">
                <Button variant="glass" className="w-full justify-start gap-2">
                  <Download className="h-4 w-4" /> Download 9:16 Vertical
                </Button>
              </a>
            )}
            {render.teaser_url && (
              <a href={render.teaser_url} target="_blank" rel="noopener noreferrer">
                <Button variant="glass" className="w-full justify-start gap-2">
                  <Download className="h-4 w-4" /> Download 15s Teaser
                </Button>
              </a>
            )}
          </div>
        )}

        {/* Beat-sync info from logs */}
        {renderLogs?.beat_sync_enabled && (
          <div className="rounded-lg bg-secondary/30 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">🎵 Beat-Synced Export</p>
            <p>BPM: {renderLogs.bpm} · {renderLogs.cuts_count} cuts aligned to beats</p>
            <p>Transitions: {renderLogs.transitions?.join(", ")}</p>
          </div>
        )}

        {/* Raw logs */}
        {render?.logs && (
          <details className="mt-2">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">View Logs</summary>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-secondary/30 rounded-lg p-3 mt-2 max-h-48 overflow-auto">
              {typeof render.logs === "string" ? render.logs : JSON.stringify(render.logs, null, 2)}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
