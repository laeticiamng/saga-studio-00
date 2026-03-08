import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, Loader2, AlertCircle, Clock, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface Shot {
  id: string;
  idx: number;
  status: string;
  prompt: string | null;
  output_url: string | null;
  duration_sec: number | null;
  provider: string | null;
  project_id: string;
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  pending: { icon: <Clock className="h-3 w-3" />, color: "text-muted-foreground" },
  generating: { icon: <Loader2 className="h-3 w-3 animate-spin" />, color: "text-primary" },
  completed: { icon: <CheckCircle className="h-3 w-3" />, color: "text-green-500" },
  failed: { icon: <AlertCircle className="h-3 w-3" />, color: "text-destructive" },
  regenerating: { icon: <Loader2 className="h-3 w-3 animate-spin" />, color: "text-amber-500" },
};

export function ShotGrid({ shots }: { shots: Shot[] }) {
  const { toast } = useToast();
  const [retrying, setRetrying] = useState<string | null>(null);

  const handleRetry = async (shot: Shot) => {
    setRetrying(shot.id);
    try {
      // Mark as regenerating
      await supabase.from("shots").update({ status: "regenerating" as any, error_message: null }).eq("id", shot.id);
      // Call generate-shots for this single shot
      await supabase.functions.invoke("generate-shots", {
        body: { project_id: shot.project_id, shot_ids: [shot.id] },
      });
      toast({ title: "Retrying", description: `Shot ${shot.idx + 1} is being regenerated` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {shots.map((shot) => {
        const config = statusConfig[shot.status] || statusConfig.pending;
        return (
          <Card key={shot.id} className="border-border/50 bg-card/40 overflow-hidden">
            <div className="aspect-video bg-secondary/30 flex items-center justify-center relative">
              {shot.output_url ? (
                <video src={shot.output_url} className="w-full h-full object-cover" muted />
              ) : (
                <span className="text-2xl font-bold text-muted-foreground/30">#{shot.idx + 1}</span>
              )}
            </div>
            <div className="p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Shot {shot.idx + 1}</span>
                <Badge variant="outline" className={`text-xs gap-1 ${config.color}`}>
                  {config.icon} {shot.status}
                </Badge>
              </div>
              {shot.prompt && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{shot.prompt}</p>
              )}
              {shot.status === "failed" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-1.5 h-7 text-xs gap-1 text-destructive hover:text-destructive"
                  onClick={() => handleRetry(shot)}
                  disabled={retrying === shot.id}
                >
                  {retrying === shot.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3 w-3" />
                  )}
                  Retry
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
