import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, Unlock, Play, Layers, Clock } from "lucide-react";

interface TimelineViewProps {
  timeline: Record<string, unknown>;
  tracks: Array<Record<string, unknown>>;
  clips: Array<Record<string, unknown>>;
  projectId: string;
}

export function TimelineView({ timeline, tracks, clips, projectId }: TimelineViewProps) {
  const totalDurationMs = clips.reduce((sum, c) => Math.max(sum, Number(c.end_time_ms) || 0), 0);
  const totalSec = Math.round(totalDurationMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;

  return (
    <div className="space-y-4">
      {/* Timeline info bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="secondary">v{String(timeline.version)}</Badge>
          <span className="text-sm font-medium">{String(timeline.name)}</span>
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            {minutes}:{String(seconds).padStart(2, "0")}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{tracks.length} piste(s)</span>
          <span>·</span>
          <span>{clips.length} clip(s)</span>
        </div>
      </div>

      {/* Track lanes */}
      {tracks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Layers className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Aucune piste. Lancez l'assemblage automatique pour créer le rough cut.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tracks.map((track) => {
            const trackClips = clips.filter(c => c.track_id === track.id);
            return (
              <Card key={String(track.id)} className="overflow-hidden">
                <div className="flex">
                  {/* Track label */}
                  <div className="w-20 sm:w-32 shrink-0 border-r bg-secondary/30 p-2 sm:p-3 flex flex-col justify-center">
                    <span className="text-[10px] sm:text-xs font-medium truncate">{String(track.label)}</span>
                    <span className="text-[8px] sm:text-[10px] text-muted-foreground capitalize">{String(track.track_type)}</span>
                  </div>
                  {/* Track lane */}
                  <div className="flex-1 relative h-16 bg-secondary/10">
                    {totalDurationMs > 0 && trackClips.map((clip) => {
                      const left = (Number(clip.start_time_ms) / totalDurationMs) * 100;
                      const width = ((Number(clip.end_time_ms) - Number(clip.start_time_ms)) / totalDurationMs) * 100;
                      return (
                        <div
                          key={String(clip.id)}
                          className={`absolute top-1 bottom-1 rounded-md border text-[10px] px-1.5 flex items-center overflow-hidden transition-colors ${
                            clip.locked
                              ? "bg-primary/20 border-primary/40"
                              : "bg-accent/30 border-accent/50 hover:bg-accent/50 cursor-pointer"
                          }`}
                          style={{ left: `${left}%`, width: `${Math.max(width, 1)}%` }}
                          title={String(clip.name || clip.provider || "Clip")}
                        >
                          {clip.locked && <Lock className="h-2.5 w-2.5 mr-0.5 shrink-0" />}
                          <span className="truncate">{String(clip.name || clip.provider || "")}</span>
                        </div>
                      );
                    })}
                    {trackClips.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground/50">
                        Vide
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
