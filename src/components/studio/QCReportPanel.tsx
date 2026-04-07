import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertTriangle, Shield } from "lucide-react";

interface QCReportPanelProps {
  timelineId: string | undefined;
  projectId: string;
}

export function QCReportPanel({ timelineId, projectId }: QCReportPanelProps) {
  const { data: reports } = useQuery({
    queryKey: ["qc_reports_timeline", timelineId],
    queryFn: async () => {
      if (!timelineId) return [];
      const { data, error } = await supabase
        .from("qc_reports")
        .select("*")
        .eq("timeline_id", timelineId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!timelineId,
  });

  if (!reports?.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <Shield className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Aucun rapport QC pour cette timeline. Le contrôle qualité sera exécuté avant l'export final.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((report) => {
        const verdict = report.overall_verdict;
        const blocking = report.has_blocking_issues;
        const checks = (report.checks as Record<string, unknown>[] | null) || [];
        const warnings = (report.warnings as string[] | null) || [];
        const blockingIssues = (report.blocking_issues as string[] | null) || [];

        return (
          <Card key={report.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  {verdict === "pass" ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : blocking ? (
                    <XCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  )}
                  Rapport QC
                </CardTitle>
                <Badge variant={verdict === "pass" ? "default" : blocking ? "destructive" : "outline"}>
                  {verdict === "pass" ? "Validé" : blocking ? "Bloquant" : "Avertissements"}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Score : {report.score ?? "—"}/100 · {new Date(report.created_at).toLocaleString("fr-FR")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {blockingIssues.length > 0 && (
                <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-2 space-y-1">
                  <span className="font-medium text-destructive">Problèmes bloquants :</span>
                  {blockingIssues.map((issue, i) => (
                    <p key={i} className="text-muted-foreground">• {String(issue)}</p>
                  ))}
                </div>
              )}
              {warnings.length > 0 && (
                <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-2 space-y-1">
                  <span className="font-medium text-amber-600">Avertissements :</span>
                  {warnings.map((w, i) => (
                    <p key={i} className="text-muted-foreground">• {String(w)}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
