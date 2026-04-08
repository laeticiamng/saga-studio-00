import { useState, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Layers, Clock, Play, Image as ImageIcon, Film } from "lucide-react";

interface TimelineViewProps {
  timeline: Record<string, unknown>;
  tracks: Array<Record<string, unknown>>;
  clips: Array<Record<string, unknown>>;
  projectId: string;
  onClipSelect?: (clip: Record<string, unknown>) => void;
}

function ClipThumbnail({ url, name }: { url: string | null; name: string }) {
  const isImage = url
    ? /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)|placehold\.co/i.test(url)
    : false;

  if (!url) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-secondary/20">
        <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
      </div>
    );
  }

  if (isImage) {
    return (
      <img
        src={url}
        alt={name}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
      />
    );
  }

  return (
    <video
      src={url}
      className="absolute inset-0 w-full h-full object-cover"
      muted
      preload="metadata"
      onLoadedMetadata={(e) => {
        const v = e.currentTarget;
        v.currentTime = 0.1; // grab first frame
      }}
    />
  );
}

export function TimelineView({ timeline, tracks, clips, projectId, onClipSelect }: TimelineViewProps) {
  const totalDurationMs = clips.reduce((sum, c) => Math.max(sum, Number(c.end_time_ms) || 0), 0);
  const totalSec = Math.round(totalDurationMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;

  const [playheadMs, setPlayheadMs] = useState(0);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || totalDurationMs <= 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    setPlayheadMs(Math.round(pct * totalDurationMs));
  }, [totalDurationMs]);

  const handleClipClick = (clip: Record<string, unknown>, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedClipId(String(clip.id));
    setPlayheadMs(Number(clip.start_time_ms) || 0);
    onClipSelect?.(clip);
  };

  // Time ruler markers
  const rulerMarkers: number[] = [];
  if (totalDurationMs > 0) {
    const step = totalDurationMs <= 30000 ? 5000 : totalDurationMs <= 120000 ? 10000 : 30000;
    for (let t = 0; t <= totalDurationMs; t += step) {
      rulerMarkers.push(t);
    }
  }

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-3">
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
          {selectedClipId && (
            <>
              <span>·</span>
              <Badge variant="default" className="text-[10px]">Clip sélectionné</Badge>
            </>
          )}
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
        <div className="space-y-0 rounded-lg border overflow-hidden bg-card">
          {/* Time ruler */}
          {totalDurationMs > 0 && (
            <div
              className="relative h-6 bg-secondary/30 border-b cursor-pointer ml-20 sm:ml-32"
              onClick={handleTimelineClick}
              ref={timelineRef}
            >
              {rulerMarkers.map((t) => (
                <div
                  key={t}
                  className="absolute top-0 bottom-0 flex flex-col items-center"
                  style={{ left: `${(t / totalDurationMs) * 100}%` }}
                >
                  <div className="w-px h-2 bg-muted-foreground/30" />
                  <span className="text-[8px] text-muted-foreground/60 select-none">{formatTime(t)}</span>
                </div>
              ))}
              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary z-10 pointer-events-none"
                style={{ left: `${(playheadMs / totalDurationMs) * 100}%` }}
              >
                <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rounded-full" />
              </div>
            </div>
          )}

          {/* Tracks */}
          {tracks.map((track) => {
            const trackClips = clips.filter(c => c.track_id === track.id);
            const isVideoTrack = String(track.track_type) === "video";
            const trackHeight = isVideoTrack ? "h-20 sm:h-24" : "h-12";

            return (
              <div key={String(track.id)} className="flex border-b last:border-b-0">
                {/* Track label */}
                <div className="w-20 sm:w-32 shrink-0 border-r bg-secondary/20 p-2 sm:p-3 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5">
                    {isVideoTrack ? (
                      <Film className="h-3 w-3 text-primary shrink-0" />
                    ) : (
                      <div className="h-3 w-3 rounded-full bg-muted-foreground/30 shrink-0" />
                    )}
                    <span className="text-[10px] sm:text-xs font-medium truncate">{String(track.label)}</span>
                  </div>
                  <span className="text-[8px] sm:text-[10px] text-muted-foreground capitalize mt-0.5">
                    {String(track.track_type)}
                  </span>
                </div>

                {/* Track lane */}
                <div
                  className={`flex-1 relative ${trackHeight} bg-background/50 cursor-pointer`}
                  onClick={handleTimelineClick}
                >
                  {totalDurationMs > 0 && trackClips.map((clip) => {
                    const left = (Number(clip.start_time_ms) / totalDurationMs) * 100;
                    const width = ((Number(clip.end_time_ms) - Number(clip.start_time_ms)) / totalDurationMs) * 100;
                    const isSelected = selectedClipId === String(clip.id);
                    const isLocked = !!clip.locked;
                    const sourceUrl = clip.source_url as string | null;

                    return (
                      <div
                        key={String(clip.id)}
                        className={`absolute top-1 bottom-1 rounded overflow-hidden border transition-all cursor-pointer group
                          ${isSelected
                            ? "border-primary ring-2 ring-primary/30 z-20"
                            : isLocked
                              ? "border-primary/40 z-10"
                              : "border-border hover:border-primary/50 z-10"
                          }`}
                        style={{ left: `${left}%`, width: `${Math.max(width, 1.5)}%` }}
                        title={String(clip.name || clip.provider || "Clip")}
                        onClick={(e) => handleClipClick(clip, e)}
                      >
                        {/* Thumbnail or color block */}
                        {isVideoTrack && sourceUrl ? (
                          <ClipThumbnail url={sourceUrl} name={String(clip.name || "")} />
                        ) : (
                          <div className={`absolute inset-0 ${
                            isLocked ? "bg-primary/15" : "bg-accent/20 group-hover:bg-accent/30"
                          }`} />
                        )}

                        {/* Overlay gradient for readability */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                        {/* Clip label */}
                        <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 flex items-center gap-0.5 z-10">
                          {isLocked && <Lock className="h-2 w-2 text-white/80 shrink-0" />}
                          <span className="text-[9px] text-white/90 truncate font-medium drop-shadow-sm">
                            {String(clip.name || clip.provider || "")}
                          </span>
                        </div>

                        {/* Provider badge */}
                        {clip.provider && (
                          <div className="absolute top-0.5 right-0.5 z-10">
                            <span className="text-[7px] bg-black/50 text-white/70 rounded px-1 py-px backdrop-blur-sm">
                              {String(clip.provider)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {trackClips.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground/40">
                      Vide
                    </div>
                  )}

                  {/* Playhead on track */}
                  {totalDurationMs > 0 && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-primary/60 z-30 pointer-events-none"
                      style={{ left: `${(playheadMs / totalDurationMs) * 100}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected clip preview */}
      {selectedClipId && (() => {
        const clip = clips.find(c => String(c.id) === selectedClipId);
        if (!clip) return null;
        const sourceUrl = clip.source_url as string | null;
        const isImage = sourceUrl
          ? /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)|placehold\.co/i.test(sourceUrl)
          : false;

        return (
          <Card className="mt-3">
            <CardContent className="p-4">
              <div className="flex gap-4">
                {/* Preview */}
                <div className="w-48 h-28 rounded-md overflow-hidden bg-black shrink-0 relative">
                  {sourceUrl ? (
                    isImage ? (
                      <img src={sourceUrl} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <video
                        src={sourceUrl}
                        className="w-full h-full object-contain"
                        controls
                        muted
                        preload="metadata"
                      />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                {/* Metadata */}
                <div className="flex-1 space-y-1.5 text-sm">
                  <p className="font-medium">{String(clip.name || "Clip")}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>
                      {formatTime(Number(clip.start_time_ms))} → {formatTime(Number(clip.end_time_ms))}
                    </span>
                    {clip.provider && (
                      <Badge variant="outline" className="text-[10px]">{String(clip.provider)}</Badge>
                    )}
                    {clip.locked && (
                      <Badge variant="secondary" className="text-[10px] gap-0.5">
                        <Lock className="h-2.5 w-2.5" /> Verrouillé
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
