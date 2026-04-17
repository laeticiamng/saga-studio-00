import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Policy {
  id: string;
  policy_key: string;
  domain: string;
  description: string | null;
  enforcement_mode: string;
}

interface PolicyModeSwitchProps {
  policies: Policy[];
  onChange?: () => void;
}

const MODE_DESCRIPTIONS: Record<string, string> = {
  off: "Désactivée — la règle est ignorée",
  shadow: "Observation — log les violations sans bloquer",
  enforce: "Application — bloque les violations",
};

const MODE_VARIANTS: Record<string, string> = {
  off: "text-muted-foreground border-border",
  shadow: "text-amber-400 border-amber-500/40",
  enforce: "text-emerald-400 border-emerald-500/40",
};

export default function PolicyModeSwitch({ policies, onChange }: PolicyModeSwitchProps) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const handleChange = async (policyKey: string, newMode: string) => {
    setPendingKey(policyKey);
    try {
      const { error } = await supabase.rpc("set_policy_enforcement", {
        p_policy_key: policyKey,
        p_mode: newMode,
      });
      if (error) throw error;
      toast.success(`Policy "${policyKey}" → ${newMode}`);
      onChange?.();
    } catch (e) {
      toast.error(`Bascule échouée : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPendingKey(null);
    }
  };

  if (policies.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" /> Modes d'application des policies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-6 text-center">
            Aucune policy configurée.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4" /> Policies de gouvernance
        </CardTitle>
        <CardDescription>
          Bascule progressive recommandée : <strong>off</strong> → <strong>shadow</strong>{" "}
          (observation 7 jours) → <strong>enforce</strong> (production).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {policies.map((p) => (
            <li
              key={p.id}
              className="py-3 flex items-center justify-between gap-3 flex-wrap"
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{p.policy_key}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {p.domain}
                  </Badge>
                </div>
                {p.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {p.description}
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground italic">
                  {MODE_DESCRIPTIONS[p.enforcement_mode] ?? ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant="outline"
                  className={MODE_VARIANTS[p.enforcement_mode] ?? ""}
                >
                  {p.enforcement_mode}
                </Badge>
                <Select
                  value={p.enforcement_mode}
                  onValueChange={(v) => handleChange(p.policy_key, v)}
                  disabled={pendingKey === p.policy_key}
                >
                  <SelectTrigger className="w-[120px] h-8">
                    {pendingKey === p.policy_key ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <SelectValue />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">off</SelectItem>
                    <SelectItem value="shadow">shadow</SelectItem>
                    <SelectItem value="enforce">enforce</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
