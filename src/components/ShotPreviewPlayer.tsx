import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward, Maximize2 } from "lucide-react";

interface Shot {
  id: string;
  idx: number;
  status: string;
  output_url: string | null;
  duration_sec: number | null;
  prompt: string | null;
}

interface ShotPreviewPlayerProps {
  shots: Shot[];
  audioUrl?: string | null;
  bpm?: number | null;
}

export function ShotPreviewPlayer({ shots, audioUrl, bpm }: ShotPreviewPlayerProps) {
  const completedShots = shots.filter(s => s.status === "completed" && s.output_url);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentShot = completedShots[currentIdx];

  const playNext = useCallback(() => {
    if (currentIdx < completedShots.length - 1) {
      setCurrentIdx(prev => prev + 1);
    } else {
      setIsPlaying(false);
      setCurrentIdx(0);
      if (audioRef.current) audioRef.current.pause();
    }
  }, [currentIdx, completedShots.length]);

  useEffect(() => {
    if (!isPlaying || !currentShot) return;

    const duration = (currentShot.duration_sec || 5) * 1000;
    timerRef.current = setTimeout(playNext, duration);

    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, currentIdx, currentShot, playNext]);

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (audioRef.current) audioRef.current.pause();
      if (videoRef.current) videoRef.current.pause();
    } else {
      setIsPlaying(true);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    }
  };

  const goTo = (idx: number) => {
    setCurrentIdx(Math.max(0, Math.min(idx, completedShots.length - 1)));
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      if (isPlaying) videoRef.current.play().catch(() => {});
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  if (completedShots.length === 0) return null;

  return (
    <Card ref={containerRef} className="border-border/50 bg-card/60 overflow-hidden">
      <div className="relative aspect-video bg-black flex items-center justify-center">
        {currentShot?.output_url ? (
          <video
            ref={videoRef}
            src={currentShot.output_url}
            className="w-full h-full object-contain"
            muted={!!audioUrl}
            playsInline
            onEnded={() => { if (isPlaying) playNext(); }}
          />
        ) : (
          <span className="text-muted-foreground">Pas d'aperçu</span>
        )}

        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-md px-2.5 py-1 text-xs text-white">
          Plan {currentShot?.idx + 1} / {completedShots.length}
          {bpm && <span className="ml-2 text-primary">♪ {Math.round(bpm)} BPM</span>}
        </div>
      </div>

      <div className="p-3 space-y-2">
        <Slider
          value={[currentIdx]}
          max={completedShots.length - 1}
          step={1}
          onValueChange={([v]) => goTo(v)}
          className="cursor-pointer"
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goTo(currentIdx - 1)} disabled={currentIdx === 0}>
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={togglePlay}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goTo(currentIdx + 1)} disabled={currentIdx >= completedShots.length - 1}>
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {currentShot?.prompt && (
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">{currentShot.prompt}</span>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleFullscreen}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}
    </Card>
  );
}