import { useNavigate } from "react-router-dom";
import { AlertTriangle, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InsufficientCreditsAlertProps {
  balance: number;
  required: number;
}

export function InsufficientCreditsAlert({ balance, required }: InsufficientCreditsAlertProps) {
  const navigate = useNavigate();

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">Crédits insuffisants</p>
        <p className="text-xs text-muted-foreground mt-1">
          Cette opération nécessite environ <strong>{required} crédits</strong>. Votre solde actuel est de{" "}
          <strong className="text-destructive">{balance} crédits</strong>.
        </p>
        <Button
          variant="default"
          size="sm"
          className="mt-3 gap-1.5"
          onClick={() => navigate("/pricing")}
        >
          <Coins className="h-4 w-4" />
          Recharger mes crédits
        </Button>
      </div>
    </div>
  );
}

/** Check if an error message indicates insufficient credits */
export function isInsufficientCreditsError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  return /insufficient.credit/i.test(msg) || /solde insuffisant/i.test(msg);
}
