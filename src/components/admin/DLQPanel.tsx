import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skull, RotateCcw, Trash2, AlertOctagon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DLQJob {
  id: string;
  job_type: string;
  slug: string | null;
  episode_id: string | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  created_at: string;
  completed_at: string | null;
}

interface DLQPanelProps {
  jobs: DLQJob[];
  onActionComplete?: () => void;
}

type Action = "replay" | "discard" | "escalate";

export default function DLQPanel({ jobs, onActionComplete }: DLQPanelProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);

  const runAction = async (job: DLQJob, action: Action, reason?: string) => {
    setPendingId(job.id);
    try {
      const { data, error } = await supabase.functions.invoke("dlq-actions", {
        body: {
          job_id: job.id,
          job_type: job.job_type,
          action,
          reason,
        },
      });
      if (error) throw error;
      const messages: Record<Action, string> = {
        replay: "Job rejoué",
        discard: "Job ignoré",
        escalate: "Incident escaladé",
      };
      toast.success(messages[action]);
      if (data?.dispatched) toast.message("Dispatché en queue");
      onActionComplete?.();
    } catch (e) {
      toast.error(`Action échouée : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPendingId(null);
    }
  };

  if (jobs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Skull className="h-4 w-4" /> Dead Letter Queue
          </CardTitle>
          <CardDescription>Jobs définitivement morts (&gt;24h, retries épuisés)</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-6 text-center">
            Aucun job mort 🌱
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Skull className="h-4 w-4" /> Dead Letter Queue
          <Badge variant="destructive" className="ml-2">
            {jobs.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          Replay = remettre en queue · Discard = abandonner · Escalate = créer un incident critique
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {jobs.map((j) => (
            <li
              key={`${j.job_type}-${j.id}`}
              className="py-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">
                      {j.job_type}
                    </Badge>
                    <p className="text-sm font-medium truncate">{j.slug ?? "—"}</p>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {j.error_message ?? "Pas de message"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {j.retry_count}/{j.max_retries} retries · mort{" "}
                    {j.completed_at
                      ? new Date(j.completed_at).toLocaleString()
                      : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendingId === j.id}
                    onClick={() => runAction(j, "replay")}
                  >
                    {pendingId === j.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3 w-3" />
                    )}
                    <span className="ml-1.5 hidden sm:inline">Replay</span>
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pendingId === j.id}
                      >
                        <Trash2 className="h-3 w-3" />
                        <span className="ml-1.5 hidden sm:inline">Discard</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Abandonner ce job ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Le job restera marqué failed définitivement. Aucune
                          relance possible sans intervention SQL.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => runAction(j, "discard", "manual_discard_from_ui")}
                        >
                          Confirmer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={pendingId === j.id}
                    onClick={() =>
                      runAction(j, "escalate", "Manual escalation from DLQ panel")
                    }
                  >
                    <AlertOctagon className="h-3 w-3" />
                    <span className="ml-1.5 hidden sm:inline">Escalate</span>
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
