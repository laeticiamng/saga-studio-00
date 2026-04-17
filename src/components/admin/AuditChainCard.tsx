import { useState } from "react";
import { Shield, ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuditChain } from "@/hooks/useAuditChain";
import { toast } from "sonner";

export default function AuditChainCard() {
  const [lastResult, setLastResult] = useState<{ intact: boolean; total: number; broken: number; at: string } | null>(null);
  const verify = useAuditChain();

  const onVerify = async () => {
    try {
      const r = await verify.mutateAsync(5000);
      setLastResult({
        intact: r.intact,
        total: r.total_rows,
        broken: r.broken.length,
        at: r.verified_at,
      });
      if (r.intact) toast.success(`Chaîne intacte — ${r.rows_inspected} entrées vérifiées`);
      else toast.error(`${r.broken.length} entrée(s) corrompue(s) détectée(s)`);
    } catch (e) {
      toast.error(`Vérification échouée : ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4" /> Audit log — chaîne de hash (WORM)
        </CardTitle>
        <CardDescription>
          Append-only en base. SHA-256 chaîné par ligne. Vérification à la demande.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            {lastResult ? (
              lastResult.intact ? (
                <Badge variant="outline" className="text-emerald-400 border-emerald-500/40 gap-1">
                  <ShieldCheck className="h-3 w-3" /> Intacte
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <ShieldAlert className="h-3 w-3" /> {lastResult.broken} cassée(s)
                </Badge>
              )
            ) : (
              <Badge variant="outline">Non vérifiée</Badge>
            )}
            {lastResult && (
              <span className="text-xs text-muted-foreground">
                {lastResult.total} entrées · {new Date(lastResult.at).toLocaleString()}
              </span>
            )}
          </div>
          <Button size="sm" onClick={onVerify} disabled={verify.isPending}>
            {verify.isPending ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Shield className="h-3.5 w-3.5 mr-2" />}
            Vérifier la chaîne
          </Button>
        </div>
        {verify.data && verify.data.broken.length > 0 && (
          <ul className="divide-y divide-border rounded-md border border-destructive/30 bg-destructive/5">
            {verify.data.broken.slice(0, 10).map((b) => (
              <li key={b.broken_id} className="p-3 text-xs">
                <p className="font-mono text-destructive">#{b.chain_position} — {b.broken_id.slice(0, 8)}…</p>
                <p className="text-muted-foreground mt-1">attendu : <code>{b.expected_hash.slice(0, 16)}…</code></p>
                <p className="text-muted-foreground">obtenu : <code>{b.actual_hash?.slice(0, 16) ?? "—"}…</code></p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
