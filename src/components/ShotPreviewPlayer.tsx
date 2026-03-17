import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward, Maximize2, Minimize2, Volume2, VolumeX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

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
  const [showControls, setShowControls] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const [progressHover, setProgressHover] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const currentShot = completedShots[currentIdx];

  // Auto-hide controls after 3s of inactivity while playing
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (isPlaying) {
      hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    } else {
      resetHideTimer();
    }
  }, [isPlaying, resetHideTimer]);

  const playNext = useCallback(() => {
    if (currentIdx < completedShots.length - 1) {
      setCurrentIdx(prev => prev + 1);
    } else {
      setIsPlaying(false);
      setCurrentIdx(0);
      if (audioRef.current) audioRef.current.pause();
    }
  }, [currentIdx, completedShots.length]);

  const isCurrentImage = currentShot?.output_url
    ? /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)|placehold\.co/i.test(currentShot.output_url)
    : false;

  useEffect(() => {
    if (!isPlaying || !currentShot) return;

    const duration = (currentShot.duration_sec || 5) * 1000;

    if (isCurrentImage) {
      timerRef.current = setTimeout(playNext, Math.min(duration, 3000));
    } else {
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
        case "j":
          e.preventDefault();
          goTo(currentIdx - 1);
          break;
        case "ArrowRight":
        case "l":
          e.preventDefault();
          goTo(currentIdx + 1);
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  // Handle progress bar click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || completedShots.length <= 1) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    const idx = Math.round(pct * (completedShots.length - 1));
    goTo(idx);
  };

  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || completedShots.length <= 1) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    setProgressHover(pct);
  };

  // Listen for fullscreen change
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  if (completedShots.length === 0) return null;

  const progressPct = completedShots.length > 1
    ? (currentIdx / (completedShots.length - 1)) * 100
    : 100;

  return (
    <div
      ref={containerRef}
      className="player-shell group/player"
      onMouseEnter={() => { setIsHovering(true); resetHideTimer(); }}
      onMouseLeave={() => { setIsHovering(false); setProgressHover(null); }}
      onMouseMove={resetHideTimer}
    >
      {/* Video viewport */}
      <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
        {currentShot?.output_url ? (
          isCurrentImage ? (
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
          <span className="text-muted-foreground text-sm">Pas d'aperçu</span>
        )}

        {/* Cinematic vignette — always visible */}
        <div className="player-vignette absolute inset-0 pointer-events-none" />

        {/* Top info bar — fade with controls */}
        <AnimatePresence>
          {(showControls || !isPlaying) && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="absolute top-0 left-0 right-0 p-3 sm:p-4 flex items-center gap-2 z-10"
              style={{ background: "linear-gradient(180deg, hsl(0 0% 0% / 0.5) 0%, transparent 100%)" }}
            >
              <Badge variant="secondary" className="bg-black/50 backdrop-blur-md border-none text-white/90 text-xs font-medium px-2.5 py-1">
                Plan {(currentShot?.idx ?? 0) + 1} / {completedShots.length}
              </Badge>
              {bpm && (
                <Badge variant="secondary" className="bg-black/50 backdrop-blur-md border-none text-primary text-xs font-medium px-2.5 py-1">
                  ♪ {Math.round(bpm)} BPM
                </Badge>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center play button — paused state */}
        <AnimatePresence>
          {!isPlaying && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer"
            >
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-white/15 backdrop-blur-xl flex items-center justify-center border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:bg-white/20 hover:scale-105 transition-all duration-200">
                <Play className="h-7 w-7 sm:h-8 sm:w-8 text-white ml-1" />
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Click-to-toggle overlay — playing state */}
        {isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 z-[5] cursor-pointer"
            aria-label="Pause"
          />
        )}

        {/* Bottom controls overlay */}
        <AnimatePresence>
          {(showControls || !isPlaying || isHovering) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-0 left-0 right-0 z-10"
            >
              {/* Controls gradient */}
              <div className="player-controls-gradient pt-16 pb-0">
                {/* Progress bar */}
                <div
                  ref={progressRef}
                  className="player-progress-track mx-3 sm:mx-4 mb-2 rounded-full overflow-visible relative group/progress"
                  style={{ background: "hsl(0 0% 100% / 0.12)" }}
                  onClick={handleProgressClick}
                  onMouseMove={handleProgressHover}
                  onMouseLeave={() => setProgressHover(null)}
                >
                  {/* Shot markers */}
                  {completedShots.length > 2 && completedShots.map((_, i) => {
                    if (i === 0 || i === completedShots.length - 1) return null;
                    const pos = (i / (completedShots.length - 1)) * 100;
                    return (
                      <div
                        key={i}
                        className="player-shot-marker"
                        style={{ left: `${pos}%` }}
                      />
                    );
                  })}

                  {/* Fill */}
                  <div
                    className="player-progress-fill"
                    style={{ width: `${progressPct}%` }}
                  />

                  {/* Thumb */}
                  <div
                    className="player-progress-thumb"
                    style={{ left: `${progressPct}%`, marginLeft: "-6px" }}
                  />

                  {/* Hover preview indicator */}
                  {progressHover !== null && (
                    <div
                      className="absolute -top-8 px-2 py-1 rounded bg-black/80 backdrop-blur-sm text-[11px] text-white/90 font-medium pointer-events-none whitespace-nowrap"
                      style={{ left: `${progressHover * 100}%`, transform: "translateX(-50%)" }}
                    >
                      Plan {Math.round(progressHover * (completedShots.length - 1)) + 1}
                    </div>
                  )}
                </div>

                {/* Controls row */}
                <div className="flex items-center justify-between px-2 sm:px-3 pb-3 sm:pb-4">
                  {/* Left controls */}
                  <div className="flex items-center gap-0.5 sm:gap-1">
                    <button
                      onClick={() => goTo(currentIdx - 1)}
                      disabled={currentIdx === 0}
                      className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all duration-150"
                    >
                      <SkipBack className="h-4 w-4" />
                    </button>
                    <button
                      onClick={togglePlay}
                      className="h-10 w-10 sm:h-11 sm:w-11 rounded-lg flex items-center justify-center text-white hover:bg-white/10 transition-all duration-150"
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={isPlaying ? "pause" : "play"}
                          initial={{ scale: 0.7, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.7, opacity: 0 }}
                          transition={{ duration: 0.12 }}
                        >
                          {isPlaying
                            ? <Pause className="h-5 w-5" />
                            : <Play className="h-5 w-5 ml-0.5" />
                          }
                        </motion.div>
                      </AnimatePresence>
                    </button>
                    <button
                      onClick={() => goTo(currentIdx + 1)}
                      disabled={currentIdx >= completedShots.length - 1}
                      className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all duration-150"
                    >
                      <SkipForward className="h-4 w-4" />
                    </button>

                    {audioUrl && (
                      <button
                        onClick={toggleMute}
                        className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all duration-150 ml-1"
                      >
                        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                      </button>
                    )}

                    {/* Time/shot indicator */}
                    <span className="text-[11px] sm:text-xs text-white/60 ml-2 tabular-nums font-medium">
                      {currentIdx + 1} / {completedShots.length}
                    </span>
                  </div>

                  {/* Right controls */}
                  <div className="flex items-center gap-1">
                    {currentShot?.prompt && (
                      <span className="text-[11px] text-white/40 truncate max-w-[120px] sm:max-w-[250px] hidden sm:block mr-2">
                        {currentShot.prompt}
                      </span>
                    )}
                    <button
                      onClick={toggleFullscreen}
                      className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all duration-150"
                    >
                      {isFullscreen
                        ? <Minimize2 className="h-4 w-4" />
                        : <Maximize2 className="h-4 w-4" />
                      }
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}
    </div>
  );
}
