import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Brain, FileText, Users, Layers, AlertTriangle, RefreshCw, CheckCircle } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProjectBrainCardProps {
  projectId: string;
  brainData?: {
    documents?: { total: number; by_role?: Record<string, number> };
    entities?: Record<string, number>;
    canonical_fields?: number;
    unresolved_conflicts?: number;
    coverage_score_pct?: number;
    series?: {
      episodes_total?: number;
      episodes_with_synopsis?: number;
      episode_coverage_pct?: number;
      character_count?: number;
      bible_count?: number;
      continuity_nodes?: number;
    };
  } | null;
  legacyDocCount?: number;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function ProjectBrainCard({
  projectId,
  brainData,
  legacyDocCount = 0,
  isLoading,
  onRefresh,
}: ProjectBrainCardProps) {
  const [isReprocessing, setIsReprocessing] = useState(false);

  const handleReprocessLegacy = async () => {
    setIsReprocessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non authentifié");

      const { data, error } = await supabase.functions.invoke("import-document", {
        body: { action: "reprocess_legacy", project_id: projectId },
      });
      if (error) throw error;
      toast.success(`${data.reprocessed} document(s) ré-analysé(s) avec le parseur actuel`);
      onRefresh?.();
    } catch (e) {
      toast.error("Erreur lors de la ré-analyse");
      console.error(e);
    } finally {
      setIsReprocessing(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Chargement du cerveau projet…
        </CardContent>
      </Card>
    );
  }

  if (!brainData) return null;

  const coverage = brainData.coverage_score_pct ?? 0;
  const totalEntities = Object.values(brainData.entities ?? {}).reduce((a, b) => a + b, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Cerveau Projet
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant={coverage >= 80 ? "default" : coverage >= 50 ? "secondary" : "destructive"}
              className="text-xs"
            >
              {coverage}% couverture
            </Badge>
            {onRefresh && (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onRefresh}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={coverage} className="h-2" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-2.5">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-sm font-bold leading-none">{brainData.documents?.total ?? 0}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Documents</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-2.5">
            <Layers className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-sm font-bold leading-none">{totalEntities}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Entités</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-2.5">
            <Users className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-sm font-bold leading-none">{brainData.series?.character_count ?? 0}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Personnages</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-2.5">
            <CheckCircle className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-sm font-bold leading-none">{brainData.canonical_fields ?? 0}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Champs canoniques</p>
            </div>
          </div>
        </div>

        {brainData.unresolved_conflicts !== undefined && brainData.unresolved_conflicts > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 p-2.5 text-xs">
            <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
            <span>{brainData.unresolved_conflicts} conflit(s) non résolu(s)</span>
          </div>
        )}

        {legacyDocCount > 0 && (
          <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3">
            <p className="text-xs font-medium text-yellow-700 mb-1.5 flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              {legacyDocCount} document(s) ancien parseur
            </p>
            <p className="text-[10px] text-muted-foreground mb-2">
              Ces documents ont été traités par une version antérieure.
              Ré-analysez-les pour obtenir des résultats fiables.
            </p>
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs w-full"
              disabled={isReprocessing}
              onClick={handleReprocessLegacy}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isReprocessing ? "animate-spin" : ""}`} />
              Ré-analyser les documents hérités
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
