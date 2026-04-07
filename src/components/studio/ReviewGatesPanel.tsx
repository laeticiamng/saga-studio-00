import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDecideReviewGate } from "@/hooks/useReviewGates";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, RefreshCw, Shield, Clock } from "lucide-react";

const GATE_LABELS: Record<string, string> = {
  character_pack: "Pack personnage",
  world_pack: "Pack univers",
  scene_plan: "Plan des scènes",
  clips: "Clips générés",
  rough_cut: "Rough Cut",
  fine_cut: "Fine Cut",
  final_export: "Export final",
  hero_shots: "Plans prestige",
  performance: "Performance",
  repair: "Réparations",
  social_exports: "Exports sociaux",
  poster: "Affiche",
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "outline" },
  approved: { label: "Approuvé", variant: "default" },
  rejected: { label: "Rejeté", variant: "destructive" },
  regenerating: { label: "Regénération…", variant: "secondary" },
  skipped: { label: "Ignoré", variant: "secondary" },
};

interface ReviewGatesPanelProps {
  projectId: string;
  gates: Array<Record<string, unknown>>;
}

export function ReviewGatesPanel({ projectId, gates }: ReviewGatesPanelProps) {
  const decide = useDecideReviewGate();
  const { toast } = useToast();

  const handleDecision = async (gateId: string, status: string, action?: string) => {
    try {
      await decide.mutateAsync({ id: gateId, status, action });
      toast({ title: status === "approved" ? "✅ Approuvé" : "Action enregistrée" });
    } catch (err: unknown) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Erreur", variant: "destructive" });
    }
  };

  if (gates.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Shield className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Les points de validation apparaîtront ici au fur et à mesure de la production.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {gates.map((gate) => {
        const gateType = String(gate.gate_type);
        const status = String(gate.status);
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
        const isPending = status === "pending";

        return (
          <Card key={String(gate.id)}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                {status === "approved" ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : status === "rejected" ? (
                  <XCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <Clock className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <span className="font-medium text-sm">{GATE_LABELS[gateType] || gateType}</span>
                  {gate.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5">{String(gate.notes)}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={config.variant}>{config.label}</Badge>
                {isPending && (
                  <>
                    <Button size="sm" variant="default" onClick={() => handleDecision(String(gate.id), "approved", "approve")}
                      disabled={decide.isPending} className="gap-1">
                      <CheckCircle className="h-3.5 w-3.5" /> Approuver
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDecision(String(gate.id), "regenerating", "regenerate")}
                      disabled={decide.isPending} className="gap-1">
                      <RefreshCw className="h-3.5 w-3.5" /> Regénérer
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDecision(String(gate.id), "rejected", "reject")}
                      disabled={decide.isPending} className="gap-1 text-destructive">
                      <XCircle className="h-3.5 w-3.5" /> Rejeter
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
