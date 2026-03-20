import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, Loader2, AlertCircle, Clock, RotateCcw, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { motion } from "framer-motion";

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

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string; bg: string }> = {
  pending: { icon: <Clock className="h-3 w-3" />, color: "text-muted-foreground", label: "En attente", bg: "bg-secondary/30" },
  generating: { icon: <Loader2 className="h-3 w-3 animate-spin" />, color: "text-primary", label: "Génération", bg: "bg-primary/5" },
  completed: { icon: <CheckCircle className="h-3 w-3" />, color: "text-green-500", label: "Terminé", bg: "bg-green-500/5" },
  failed: { icon: <AlertCircle className="h-3 w-3" />, color: "text-destructive", label: "Échoué", bg: "bg-destructive/5" },
  regenerating: { icon: <Loader2 className="h-3 w-3 animate-spin" />, color: "text-amber-500", label: "Régénération", bg: "bg-amber-500/5" },
};

export function ShotGrid({ shots }: { shots: Shot[] }) {
  const { toast } = useToast();
  const [retrying, setRetrying] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const handleRetry = async (shot: Shot) => {
    setRetrying(shot.id);
    try {
      await supabase.from("shots").update({ status: "regenerating" as any, error_message: null }).eq("id", shot.id);
      await supabase.functions.invoke("generate-shots", {
        body: { project_id: shot.project_id, shot_ids: [shot.id] },
      });
      toast({ title: "Nouvelle tentative", description: `Le plan ${shot.idx + 1} est en cours de régénération` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Une erreur inattendue s'est produite";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {shots.map((shot, i) => {
        const config = statusConfig[shot.status] || statusConfig.pending;
        const isPlaying = playingId === shot.id;

        return (
          <motion.div
            key={shot.id}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.6), ease: "easeOut" }}
          >
          <Card key={shot.id} className="border-border/50 bg-card/40 overflow-hidden group hover:border-border transition-colors">
            {/* Thumbnail */}
            <div className="aspect-video bg-secondary/20 flex items-center justify-center relative overflow-hidden">
              {shot.output_url ? (
                <>
                  <video
                    src={shot.output_url}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    loop
                    onMouseEnter={(e) => { e.currentTarget.play().catch(() => {}); setPlayingId(shot.id); }}
                    onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; setPlayingId(null); }}
                    onClick={(e) => {
                      const vid = e.currentTarget;
                      if (isPlaying) { vid.pause(); vid.currentTime = 0; setPlayingId(null); }
                      else { vid.play().catch(() => {}); setPlayingId(shot.id); }
                    }}
                  />
                  {!isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 sm:opacity-0 sm:group-hover:opacity-100 opacity-100 transition-opacity pointer-events-none">
                      <Play className="h-6 w-6 sm:h-8 sm:w-8 text-white/80" />
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl font-bold text-muted-foreground/20">#{shot.idx + 1}</span>
                  {shot.status === "generating" && <Loader2 className="h-4 w-4 animate-spin text-primary/50" />}
                </div>
              )}

              {/* Status Badge overlay */}
              <div className="absolute top-2 right-2">
                <Badge variant="outline" className={`text-[10px] gap-1 ${config.color} ${config.bg} backdrop-blur-sm border-none px-2 py-0.5`}>
                  {config.icon} {config.label}
                </Badge>
              </div>
            </div>

            {/* Info */}
            <div className="p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Plan {shot.idx + 1}</span>
                {shot.provider && (
                  <span className="text-[10px] text-muted-foreground capitalize">{shot.provider}</span>
                )}
              </div>
              {shot.prompt && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{shot.prompt}</p>
              )}
              {shot.status === "failed" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-1 h-7 text-xs gap-1.5 text-destructive hover:text-destructive border-destructive/30"
                  onClick={() => handleRetry(shot)}
                  disabled={retrying === shot.id}
                >
                  {retrying === shot.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                  Réessayer
                </Button>
              )}
            </div>
          </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
