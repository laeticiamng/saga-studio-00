import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, ShieldX, Wrench, RefreshCw } from "lucide-react";
import { useAnomalyEvents } from "@/hooks/useValidation";
import { CATEGORY_LABELS, REPAIR_ACTION_LABELS, type AberrationCategory, type RepairAction } from "@/lib/aberration-taxonomy";

interface AnomalyDetailsDrawerProps {
  validationId: string;
  trigger: React.ReactNode;
  onRepair?: (anomalyId: string, category: string) => void;
}

export function AnomalyDetailsDrawer({ validationId, trigger, onRepair }: AnomalyDetailsDrawerProps) {
  const { data: anomalies, isLoading } = useAnomalyEvents(validationId);

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-[420px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Anomalies détectées
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-100px)] mt-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : !anomalies?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune anomalie</p>
          ) : (
            <div className="space-y-3 pr-2">
              {anomalies.map((anomaly) => {
                const catLabel = CATEGORY_LABELS[anomaly.category as AberrationCategory] ?? anomaly.category;
                return (
                  <div key={anomaly.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {anomaly.blocking ? (
                          <ShieldX className="h-4 w-4 text-destructive shrink-0" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-sm font-medium">{catLabel}</span>
                        {anomaly.subcategory && (
                          <Badge variant="outline" className="text-[10px]">
                            {anomaly.subcategory.replace(/_/g, " ")}
                          </Badge>
                        )}
                      </div>
                      <Badge
                        variant={anomaly.severity === "blocking" ? "destructive" : anomaly.severity === "major" ? "secondary" : "outline"}
                        className="text-[10px] shrink-0"
                      >
                        {anomaly.severity}
                      </Badge>
                    </div>

                    {anomaly.explanation && (
                      <p className="text-xs text-muted-foreground">{anomaly.explanation}</p>
                    )}

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="text-[10px] text-muted-foreground space-x-3">
                        <span>Confiance: {Math.round((anomaly.confidence ?? 0) * 100)}%</span>
                        {anomaly.auto_fix_attempted && (
                          <span className="text-primary">
                            Auto-repair: {anomaly.auto_fix_result ?? "tenté"}
                          </span>
                        )}
                      </div>
                      {onRepair && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] gap-1"
                          onClick={() => onRepair(anomaly.id, anomaly.category)}
                        >
                          <Wrench className="h-3 w-3" />
                          {anomaly.suggested_fix
                            ? REPAIR_ACTION_LABELS[anomaly.suggested_fix as RepairAction] ?? anomaly.suggested_fix
                            : "Réparer"}
                        </Button>
                      )}
                    </div>

                    {anomaly.suggested_fix && (
                      <p className="text-[10px] text-muted-foreground italic">
                        Suggestion: {anomaly.suggested_fix.replace(/_/g, " ")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
