import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, KeyRound } from "lucide-react";

export interface SecretCheck {
  key: string;
  status: "ok" | "missing" | "error";
  required?: boolean;
  category?: string;
}

export default function SecretsReadinessCard({ secrets }: { secrets: SecretCheck[] }) {
  const missingRequired = secrets.filter((s) => s.required && s.status !== "ok");
  const ok = secrets.filter((s) => s.status === "ok").length;
  const total = secrets.length;

  return (
    <Card className={missingRequired.length > 0 ? "border-destructive/40" : ""}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          Secrets readiness
          <Badge variant={missingRequired.length > 0 ? "destructive" : "outline"}>
            {ok}/{total}
          </Badge>
        </CardTitle>
        <CardDescription>
          {missingRequired.length > 0
            ? `${missingRequired.length} secret(s) requis manquant(s) — production bloquée`
            : "Tous les secrets requis sont configurés"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {secrets.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-sm">
              {s.status === "ok" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className={`h-3.5 w-3.5 shrink-0 ${s.required ? "text-destructive" : "text-muted-foreground"}`} />
              )}
              <code className="text-xs">{s.key}</code>
              {s.required && s.status !== "ok" && (
                <Badge variant="destructive" className="text-[10px] py-0">required</Badge>
              )}
              {!s.required && s.status !== "ok" && (
                <Badge variant="outline" className="text-[10px] py-0">optional</Badge>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
