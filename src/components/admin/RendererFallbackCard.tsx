import { Activity, Server, ServerOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRendererFallback } from "@/hooks/useAuditChain";

export default function RendererFallbackCard() {
  const { data, isLoading } = useRendererFallback();

  if (isLoading) return null;

  const healthy = data?.external_healthy ?? true;
  const fallback = data?.fallback_active ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" /> Renderer externe (FFmpeg)
        </CardTitle>
        <CardDescription>
          Surveillance du service de rendu serveur. Bascule auto vers client-assembly si dégradé.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            {healthy ? <Server className="h-4 w-4 text-emerald-400" /> : <ServerOff className="h-4 w-4 text-destructive" />}
            État externe
          </span>
          <Badge variant={healthy ? "outline" : "destructive"} className={healthy ? "text-emerald-400 border-emerald-500/40" : ""}>
            {healthy ? "OK" : "Dégradé"}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Mode fallback actif</span>
          <Badge variant={fallback ? "destructive" : "outline"}>
            {fallback ? "Oui — client-assembly" : "Non"}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Échecs consécutifs</span>
          <span>{data?.consecutive_failures ?? 0}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Dernière vérif</span>
          <span>{data?.last_check_at ? new Date(data.last_check_at).toLocaleString() : "—"}</span>
        </div>
        {data?.notes && (
          <p className="text-xs text-muted-foreground italic mt-2">{data.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}
