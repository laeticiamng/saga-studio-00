import { AlertTriangle, AlertCircle, Info, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Incident {
  id: string;
  title: string;
  detail?: string | null;
  scope: string;
  severity: string;
  status: string;
  root_cause_class?: string | null;
  auto_retry_count: number;
  created_at: string;
}

const severityConfig: Record<string, { icon: React.ElementType; color: string }> = {
  critical: { icon: XCircle, color: "text-destructive" },
  blocking: { icon: AlertCircle, color: "text-destructive" },
  warning: { icon: AlertTriangle, color: "text-yellow-500" },
  info: { icon: Info, color: "text-muted-foreground" },
};

export function IncidentFeed({ incidents }: { incidents: Incident[] }) {
  if (!incidents.length) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Aucun incident actif
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3 pr-3">
        {incidents.map((inc) => {
          const cfg = severityConfig[inc.severity] ?? severityConfig.info;
          const Icon = cfg.icon;
          return (
            <div
              key={inc.id}
              className="rounded-lg border border-border bg-card p-3 space-y-1"
            >
              <div className="flex items-start gap-2">
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{inc.title}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {inc.scope}
                    </Badge>
                    <Badge
                      variant={inc.status === "open" ? "destructive" : "secondary"}
                      className="text-[10px]"
                    >
                      {inc.status}
                    </Badge>
                  </div>
                  {inc.detail && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {inc.detail}
                    </p>
                  )}
                  <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                    {inc.root_cause_class && <span>Cause: {inc.root_cause_class}</span>}
                    {inc.auto_retry_count > 0 && (
                      <span>Retries: {inc.auto_retry_count}</span>
                    )}
                    <span>{new Date(inc.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
