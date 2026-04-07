import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDecideReviewGate } from "@/hooks/useReviewGates";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, RefreshCw, Shield, Clock, AlertTriangle, Lock } from "lucide-react";

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

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
  pending: { label: "En attente", variant: "outline", icon: Clock },
  approved: { label: "Approuvé", variant: "default", icon: CheckCircle },
  rejected: { label: "Rejeté", variant: "destructive", icon: XCircle },
  regenerating: { label: "Regénération…", variant: "secondary", icon: RefreshCw },
  skipped: { label: "Ignoré", variant: "secondary", icon: Clock },
  stale: { label: "Invalidé", variant: "destructive", icon: AlertTriangle },
};

// Gate ordering for visual display
const GATE_ORDER = [
  "character_pack", "world_pack", "scene_plan", "clips",
  "hero_shots", "performance", "repair",
  "rough_cut", "fine_cut", "final_export",
  "social_exports", "poster",
];

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
      const messages: Record<string, string> = {
        approved: "✅ Approuvé",
        rejected: "❌ Rejeté — les gates en aval ont été invalidées",
        regenerating: "🔄 Regénération lancée — les gates en aval ont été invalidées",
      };
      toast({ title: messages[status] || "Action enregistrée" });
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

  // Sort gates by canonical order
  const sortedGates = [...gates].sort((a, b) => {
    const aIdx = GATE_ORDER.indexOf(String(a.gate_type));
    const bIdx = GATE_ORDER.indexOf(String(b.gate_type));
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });

  return (
    <div className="space-y-3">
      {sortedGates.map((gate) => {
        const gateType = String(gate.gate_type);
        const status = String(gate.status);
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
        const isPending = status === "pending";
        const isStale = status === "stale";
        const isLocking = gateType === "rough_cut" || gateType === "fine_cut";
        const IconComponent = config.icon;

        return (
          <Card key={String(gate.id)} className={isStale ? "border-destructive/30 bg-destructive/5" : ""}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <IconComponent className={`h-5 w-5 ${
                  status === "approved" ? "text-green-500" :
                  status === "rejected" || isStale ? "text-destructive" :
                  "text-muted-foreground"
                }`} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{GATE_LABELS[gateType] || gateType}</span>
                    {isLocking && status === "approved" && (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                  {gate.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5">{String(gate.notes)}</p>
                  )}
                  {isLocking && isPending && (
                    <p className="text-xs text-amber-600 mt-0.5">
                      ⚠️ L'approbation verrouillera {gateType === "rough_cut" ? "les clips" : "la timeline"}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={config.variant}>{config.label}</Badge>
                {(isPending || isStale) && (
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
