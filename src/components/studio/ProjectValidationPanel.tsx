import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ShieldCheck, ShieldX, AlertTriangle, BarChart3 } from "lucide-react";
import { useAssetValidations, useProjectValidationReport } from "@/hooks/useValidation";

export function ProjectValidationPanel({ projectId }: { projectId: string }) {
  const { data: validations } = useAssetValidations(projectId);
  const { data: report } = useProjectValidationReport(projectId);

  const total = validations?.length ?? 0;
  const passed = validations?.filter((v) => v.validation_status === "passed").length ?? 0;
  const failed = validations?.filter((v) => v.validation_status === "failed").length ?? 0;
  const blocked = validations?.filter((v) => v.validation_status === "blocked" || v.blocking).length ?? 0;
  const pending = validations?.filter((v) => v.validation_status === "pending" || v.validation_status === "running").length ?? 0;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  const readiness = report?.premium_readiness_score ?? (total > 0 ? passRate : 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-3 text-center">
            <ShieldCheck className="h-4 w-4 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold">{passed}</p>
            <p className="text-[10px] text-muted-foreground">Validés</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 text-center">
            <AlertTriangle className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold">{failed}</p>
            <p className="text-[10px] text-muted-foreground">Anomalies</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 text-center">
            <ShieldX className="h-4 w-4 mx-auto text-destructive mb-1" />
            <p className="text-lg font-bold">{blocked}</p>
            <p className="text-[10px] text-muted-foreground">Bloqués</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 text-center">
            <BarChart3 className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold">{pending}</p>
            <p className="text-[10px] text-muted-foreground">En attente</p>
          </CardContent>
        </Card>
      </div>

      {/* Readiness */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            Premium Readiness
            <Badge variant={readiness >= 80 ? "default" : readiness >= 50 ? "secondary" : "destructive"}>
              {readiness}%
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={readiness} className="h-2" />
          <p className="text-[10px] text-muted-foreground mt-2">
            {readiness >= 80
              ? "Qualité suffisante pour export premium."
              : readiness >= 50
                ? "Certaines anomalies doivent être résolues avant export."
                : "Trop d'anomalies bloquantes. Résolvez les problèmes avant export."}
          </p>
        </CardContent>
      </Card>

      {/* Recent failures */}
      {(failed > 0 || blocked > 0) && validations && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Assets avec anomalies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {validations
                .filter((v) => v.validation_status === "failed" || v.validation_status === "blocked")
                .slice(0, 10)
                .map((v) => (
                  <div key={v.id} className="flex items-center justify-between text-xs border rounded-md p-1.5">
                    <span className="truncate flex-1">{v.asset_type} — {v.explanation?.slice(0, 60) ?? "Anomalie"}</span>
                    <Badge variant={v.blocking ? "destructive" : "secondary"} className="text-[9px] ml-2 shrink-0">
                      {v.validation_status}
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
