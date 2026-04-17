import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface InvariantCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  status: "ok" | "warn" | "error";
  hint?: string;
}

const statusStyles: Record<InvariantCardProps["status"], string> = {
  ok: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
  warn: "border-amber-500/40 bg-amber-500/5 text-amber-400",
  error: "border-destructive/40 bg-destructive/5 text-destructive",
};

export default function InvariantCard({ label, value, icon: Icon, status, hint }: InvariantCardProps) {
  return (
    <Card className={cn("border", statusStyles[status])}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
          </div>
          <Icon className="h-5 w-5 opacity-70" />
        </div>
      </CardContent>
    </Card>
  );
}
