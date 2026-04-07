import { ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface Violation {
  id: string;
  policy_key: string;
  entity_type: string;
  reason: string;
  severity: string;
  resolved: boolean;
  created_at: string;
}

export function PolicyViolationAlert({ violations }: { violations: Violation[] }) {
  const unresolved = violations.filter((v) => !v.resolved);
  if (!unresolved.length) return null;

  return (
    <div className="space-y-2">
      {unresolved.slice(0, 5).map((v) => (
        <Alert key={v.id} variant="destructive" className="py-2">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle className="text-xs flex items-center gap-2">
            {v.policy_key.replace(/_/g, " ")}
            <Badge variant="outline" className="text-[9px]">{v.severity}</Badge>
          </AlertTitle>
          <AlertDescription className="text-xs mt-1">
            {v.reason}
          </AlertDescription>
        </Alert>
      ))}
      {unresolved.length > 5 && (
        <p className="text-xs text-muted-foreground text-center">
          +{unresolved.length - 5} autres violations
        </p>
      )}
    </div>
  );
}
