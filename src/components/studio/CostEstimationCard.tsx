import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjectBudget, useUpsertProjectBudget } from "@/hooks/useProjectBudget";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { DollarSign, AlertTriangle, Shield } from "lucide-react";

interface CostEstimationCardProps {
  projectId: string;
}

export function CostEstimationCard({ projectId }: CostEstimationCardProps) {
  const { data: budget } = useProjectBudget(projectId);
  const upsert = useUpsertProjectBudget();
  const { toast } = useToast();

  const [limit, setLimit] = useState("");
  const [costMode, setCostMode] = useState("preview_first");

  useEffect(() => {
    if (budget) {
      setLimit(budget.budget_limit_credits?.toString() || "");
      setCostMode(budget.cost_mode);
    }
  }, [budget]);

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({
        project_id: projectId,
        budget_limit_credits: limit ? parseInt(limit) : undefined,
        cost_mode: costMode,
      });
      toast({ title: "Budget mis à jour" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const estimated = budget?.estimated_total_cost ?? 0;
  const actual = budget?.actual_total_cost ?? 0;
  const budgetLimit = budget?.budget_limit_credits;
  const overBudget = budgetLimit && actual > budgetLimit;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-4 w-4 text-primary" /> Gouvernance des coûts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current spend */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-secondary/30 p-3 text-center">
            <span className="text-[10px] text-muted-foreground block">Estimé</span>
            <span className="text-lg font-bold">{estimated}</span>
            <span className="text-[10px] text-muted-foreground"> cr</span>
          </div>
          <div className="rounded-lg bg-secondary/30 p-3 text-center">
            <span className="text-[10px] text-muted-foreground block">Dépensé</span>
            <span className={`text-lg font-bold ${overBudget ? "text-destructive" : ""}`}>{actual}</span>
            <span className="text-[10px] text-muted-foreground"> cr</span>
          </div>
          <div className="rounded-lg bg-secondary/30 p-3 text-center">
            <span className="text-[10px] text-muted-foreground block">Plafond</span>
            <span className="text-lg font-bold">{budgetLimit ?? "∞"}</span>
            <span className="text-[10px] text-muted-foreground"> cr</span>
          </div>
        </div>

        {overBudget && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Plafond de budget dépassé — la génération premium est bloquée.
          </div>
        )}

        {/* Settings */}
        <div className="space-y-3 border-t pt-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Plafond (crédits)</Label>
            <Input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Illimité" className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Mode de coût</Label>
            <Select value={costMode} onValueChange={setCostMode}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="preview_first">Preview d'abord (économique)</SelectItem>
                <SelectItem value="premium_first">Premium d'abord (qualité max)</SelectItem>
                <SelectItem value="strict_budget">Budget strict (ne dépasse jamais)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={handleSave} disabled={upsert.isPending} className="w-full">
            <Shield className="h-3.5 w-3.5 mr-1.5" /> Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
