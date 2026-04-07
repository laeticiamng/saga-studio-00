import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, ShieldX, Loader2, Clock } from "lucide-react";

type Status = "pending" | "running" | "passed" | "failed" | "blocked";

const config: Record<Status, { icon: React.ElementType; variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  pending: { icon: Clock, variant: "outline", label: "En attente" },
  running: { icon: Loader2, variant: "secondary", label: "Analyse…" },
  passed: { icon: ShieldCheck, variant: "default", label: "Validé" },
  failed: { icon: ShieldAlert, variant: "secondary", label: "Anomalies" },
  blocked: { icon: ShieldX, variant: "destructive", label: "Bloqué" },
};

export function ValidationBadge({
  status,
  anomalyCount,
  compact = false,
}: {
  status: Status;
  anomalyCount?: number;
  compact?: boolean;
}) {
  const cfg = config[status] ?? config.pending;
  const Icon = cfg.icon;

  return (
    <Badge variant={cfg.variant} className="gap-1 text-[10px]">
      <Icon className={`h-3 w-3 ${status === "running" ? "animate-spin" : ""}`} />
      {!compact && cfg.label}
      {anomalyCount != null && anomalyCount > 0 && (
        <span className="ml-0.5">({anomalyCount})</span>
      )}
    </Badge>
  );
}
