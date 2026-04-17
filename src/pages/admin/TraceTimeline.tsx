import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Bot, FileText, AlertTriangle, Activity } from "lucide-react";
import { useTraceTimeline, type TraceEvent } from "@/hooks/useTraceTimeline";
import { usePageTitle } from "@/hooks/usePageTitle";

const SOURCE_ICONS: Record<TraceEvent["source"], typeof Bot> = {
  agent_run: Bot,
  audit_log: FileText,
  diagnostic_event: AlertTriangle,
};

const SEVERITY_COLOR: Record<string, string> = {
  error: "text-destructive border-destructive/40",
  warning: "text-amber-400 border-amber-500/40",
  info: "text-primary border-primary/40",
};

export default function TraceTimeline() {
  const { correlationId } = useParams<{ correlationId: string }>();
  usePageTitle(`Trace ${correlationId?.slice(0, 8)} — Admin`);
  const { data, isLoading, error } = useTraceTimeline(correlationId);

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/architecture-health">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Retour
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Distributed trace
            </h1>
            <p className="text-xs text-muted-foreground font-mono">{correlationId}</p>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <Card>
            <CardContent className="p-6 text-destructive">{String(error)}</CardContent>
          </Card>
        )}

        {data && data.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Aucun évènement pour ce correlation_id.
            </CardContent>
          </Card>
        )}

        {data && data.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline ({data.length} évènements)</CardTitle>
              <CardDescription>Ordre chronologique — agents · audit · diagnostics</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="relative border-l border-border ml-3 space-y-6">
                {data.map((e) => {
                  const Icon = SOURCE_ICONS[e.source];
                  const sevClass = e.severity ? SEVERITY_COLOR[e.severity] : "";
                  return (
                    <li key={`${e.source}-${e.id}`} className="ml-6">
                      <span className="absolute -left-3 flex items-center justify-center w-6 h-6 bg-card border border-border rounded-full">
                        <Icon className="h-3 w-3 text-muted-foreground" />
                      </span>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge variant="outline" className={sevClass}>{e.source}</Badge>
                        <span className="text-sm font-medium">{e.title}</span>
                        {e.status && <Badge variant="secondary">{e.status}</Badge>}
                      </div>
                      {e.detail && (
                        <p className="text-xs text-muted-foreground">{e.detail}</p>
                      )}
                      <time className="block text-xs text-muted-foreground/70 mt-0.5">
                        {new Date(e.ts).toLocaleString()}
                      </time>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
