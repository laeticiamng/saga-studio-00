import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward, Maximize2, Volume2, VolumeX } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  const [isMuted, setIsMuted] = useState(!audioUrl);
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

  // Detect if current shot is an image (not a video)
  const isCurrentImage = currentShot?.output_url
    ? /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)|placehold\.co/i.test(currentShot.output_url)
    : false;

  useEffect(() => {
    if (!isPlaying || !currentShot) return;

    const duration = (currentShot.duration_sec || 5) * 1000;

    // For images, always use timer-based advancement
    if (isCurrentImage) {
      timerRef.current = setTimeout(playNext, Math.min(duration, 3000)); // 3s max for images
    } else {
      // For videos, use timer as fallback + video onEnded
      timerRef.current = setTimeout(playNext, duration);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, currentIdx, currentShot, playNext, isCurrentImage]);

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

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) audioRef.current.muted = !isMuted;
  };

  if (completedShots.length === 0) return null;

  return (
    <Card ref={containerRef} className="border-border/50 bg-card/60 overflow-hidden">
      {/* Video viewport */}
      <div className="relative aspect-video bg-black flex items-center justify-center">
        {currentShot?.output_url ? (
          // Detect if URL is an image (placeholder, .jpg, .png, .webp) vs actual video
          /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)|placehold\.co/i.test(currentShot.output_url) ? (
            <img
              src={currentShot.output_url}
              alt={`Shot ${(currentShot.idx ?? 0) + 1}`}
              className="w-full h-full object-contain"
            />
          ) : (
            <video
              ref={videoRef}
              src={currentShot.output_url}
              className="w-full h-full object-contain"
              muted={!!audioUrl}
              playsInline
              onEnded={() => { if (isPlaying) playNext(); }}
            />
          )
        ) : (
          <span className="text-muted-foreground">Pas d'aperçu</span>
        )}

        {/* Overlay info */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <Badge variant="secondary" className="bg-black/60 backdrop-blur-sm border-none text-white text-xs">
            Plan {(currentShot?.idx ?? 0) + 1} / {completedShots.length}
          </Badge>
          {bpm && (
            <Badge variant="secondary" className="bg-black/60 backdrop-blur-sm border-none text-primary text-xs">
              ♪ {Math.round(bpm)} BPM
            </Badge>
          )}
        </div>

        {/* Click to play/pause overlay */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/10 hover:bg-black/20 transition-colors group/play"
          >
            <div className="h-14 w-14 rounded-full bg-primary/90 flex items-center justify-center opacity-80 group-hover/play:opacity-100 group-hover/play:scale-110 transition-all">
              <Play className="h-6 w-6 text-primary-foreground ml-0.5" />
            </div>
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 space-y-3">
        {/* Timeline slider */}
        <Slider
          value={[currentIdx]}
          max={Math.max(0, completedShots.length - 1)}
          step={1}
          onValueChange={([v]) => goTo(v)}
          className="cursor-pointer"
        />

        <div className="flex items-center justify-between">
          {/* Playback controls */}
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => goTo(currentIdx - 1)} disabled={currentIdx === 0}>
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={togglePlay}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => goTo(currentIdx + 1)} disabled={currentIdx >= completedShots.length - 1}>
              <SkipForward className="h-4 w-4" />
            </Button>
            {audioUrl && (
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleMute}>
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
            )}
          </div>

          {/* Right side info */}
          <div className="flex items-center gap-3">
            {currentShot?.prompt && (
              <span className="text-xs text-muted-foreground truncate max-w-[150px] sm:max-w-[300px] hidden sm:block">
                {currentShot.prompt}
              </span>
            )}
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleFullscreen}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}
    </Card>
  );
}
