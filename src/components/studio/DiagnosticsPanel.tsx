import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDiagnosticEvents } from "@/hooks/useDiagnosticEvents";
import { AlertTriangle, Info, XCircle, AlertCircle, Activity } from "lucide-react";

const SEVERITY_CONFIG: Record<string, { icon: React.ElementType; color: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  info: { icon: Info, color: "text-blue-500", variant: "secondary" },
  warning: { icon: AlertTriangle, color: "text-amber-500", variant: "outline" },
  error: { icon: XCircle, color: "text-destructive", variant: "destructive" },
  critical: { icon: AlertCircle, color: "text-destructive", variant: "destructive" },
};

const SCOPE_LABELS: Record<string, string> = {
  project: "Projet",
  scene: "Scène",
  job: "Job",
  export: "Export",
  clip: "Clip",
  provider: "Provider",
  ingestion: "Ingestion",
};

interface DiagnosticsPanelProps {
  projectId: string;
}

export function DiagnosticsPanel({ projectId }: DiagnosticsPanelProps) {
  const { data: events, isLoading } = useDiagnosticEvents(projectId);

  const scopes = ["project", "scene", "job", "export", "clip", "provider", "ingestion"] as const;

  if (isLoading) {
    return (
      <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Chargement…</CardContent></Card>
    );
  }

  if (!events?.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Activity className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Aucun événement diagnostic pour le moment.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-primary" /> Diagnostics
          </CardTitle>
          <CardDescription>Événements techniques lisibles par humains — erreurs, fallbacks, avertissements</CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="project">
        <TabsList className="bg-secondary/40 p-1 rounded-xl flex-wrap">
          {scopes.map((scope) => {
            const count = events.filter(e => e.scope === scope).length;
            if (count === 0) return null;
            return (
              <TabsTrigger key={scope} value={scope} className="gap-1 rounded-lg text-xs">
                {SCOPE_LABELS[scope]}
                <Badge variant="secondary" className="text-[10px] px-1">{count}</Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {scopes.map((scope) => (
          <TabsContent key={scope} value={scope} className="space-y-2 mt-3">
            {events
              .filter(e => e.scope === scope)
              .map((event) => {
                const severity = event.severity || "info";
                const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.info;
                const Icon = config.icon;
                return (
                  <Card key={event.id}>
                    <CardContent className="py-3 flex items-start gap-3">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-medium text-sm">{event.title}</span>
                          <Badge variant={config.variant} className="text-[10px]">{severity}</Badge>
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {new Date(event.created_at).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                          </span>
                        </div>
                        {event.detail && (
                          <p className="text-xs text-muted-foreground">{event.detail}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
