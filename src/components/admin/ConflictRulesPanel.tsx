import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GitMerge } from "lucide-react";
import { toast } from "sonner";

const STRATEGIES = ["most_recent", "highest_confidence", "source_priority", "manual"] as const;

interface Rule {
  id: string;
  entity_type: string;
  field_key: string;
  strategy: string;
  is_active: boolean;
}

export default function ConflictRulesPanel() {
  const qc = useQueryClient();
  const { data: rules } = useQuery({
    queryKey: ["conflict-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conflict_resolution_rules")
        .select("*")
        .order("entity_type")
        .order("field_key");
      if (error) throw error;
      return data as Rule[];
    },
  });

  const { data: log } = useQuery({
    queryKey: ["conflict-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conflict_resolution_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const updateStrategy = async (id: string, strategy: string) => {
    const { error } = await supabase
      .from("conflict_resolution_rules")
      .update({ strategy })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Règle mise à jour");
      qc.invalidateQueries({ queryKey: ["conflict-rules"] });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GitMerge className="h-4 w-4" />
            Règles de résolution canonical ({rules?.length ?? 0})
          </CardTitle>
          <CardDescription>
            Stratégie par champ — appliquée toutes les 15 min par <code>resolve-canonical-conflicts</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!rules?.length ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucune règle configurée.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rules.map((r) => (
                <li key={r.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      <code className="text-primary">{r.entity_type}</code>.{r.field_key}
                    </p>
                  </div>
                  <Select value={r.strategy} onValueChange={(v) => updateStrategy(r.id, v)}>
                    <SelectTrigger className="w-44 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STRATEGIES.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Résolutions récentes ({log?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!log?.length ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucune résolution automatique encore.</p>
          ) : (
            <ul className="divide-y divide-border">
              {log.map((l) => (
                <li key={l.id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <Badge variant="outline" className="text-xs">{l.strategy_used}</Badge>
                    <span className="ml-2 text-muted-foreground text-xs">
                      conflit {l.conflict_id?.slice(0, 8)}
                    </span>
                  </div>
                  <time className="text-xs text-muted-foreground">
                    {new Date(l.created_at).toLocaleString()}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
