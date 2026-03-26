import { motion } from "framer-motion";
import { Play, Pause } from "lucide-react";
import { useState } from "react";
import example1 from "@/assets/example-1.jpg";
import example2 from "@/assets/example-2.jpg";
import example3 from "@/assets/example-3.jpg";
import exampleAnime from "@/assets/example-anime.jpg";
import exampleNeon from "@/assets/example-neon.jpg";

const slides = [
  { image: example1, label: "Cyberpunk" },
  { image: exampleAnime, label: "Anime" },
  { image: example2, label: "3D Animation" },
  { image: exampleNeon, label: "Néon Noir" },
  { image: example3, label: "Cinématique" },
];

export default function HeroDemo() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);

  // Auto-advance slides
  useState(() => {
    if (!playing) return;
    const id = setInterval(() => setActive((p) => (p + 1) % slides.length), 3000);
    return () => clearInterval(id);
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.6 }}
      className="mt-12 sm:mt-16 max-w-3xl mx-auto"
    >
      {/* Fake player shell */}
      <div className="player-shell relative group">
        {/* Main image area */}
        <div className="relative aspect-video overflow-hidden rounded-xl">
          {slides.map((slide, i) => (
            <motion.img
              key={slide.label}
              src={slide.image}
              alt={`Démo style ${slide.label}`}
              className="absolute inset-0 w-full h-full object-cover"
              initial={false}
              animate={{ opacity: i === active ? 1 : 0, scale: i === active ? 1 : 1.05 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />
          ))}

          {/* Vignette */}
          <div className="absolute inset-0 player-vignette pointer-events-none" />

          {/* Play/Pause center overlay */}
          <button
            onClick={() => setPlaying((p) => !p)}
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"
          >
            <div className="h-14 w-14 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
              {playing ? (
                <Pause className="h-6 w-6 text-primary-foreground" />
              ) : (
                <Play className="h-6 w-6 text-primary-foreground ml-0.5" />
              )}
            </div>
          </button>

          {/* Bottom controls bar */}
          <div className="absolute bottom-0 left-0 right-0 player-controls-gradient px-4 pb-3 pt-8">
            {/* Progress bar */}
            <div className="player-progress-track mb-3 bg-foreground/20 rounded-full overflow-hidden">
              <motion.div
                className="player-progress-fill"
                animate={{ width: `${((active + 1) / slides.length) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            {/* Style pills */}
            <div className="flex gap-2 flex-wrap">
              {slides.map((slide, i) => (
                <button
                  key={slide.label}
                  onClick={() => { setActive(i); setPlaying(false); }}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-all duration-200 ${
                    i === active
                      ? "bg-primary/90 text-primary-foreground border-primary/60"
                      : "bg-background/30 text-foreground/70 border-foreground/10 hover:bg-background/50"
                  }`}
                >
                  {slide.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-3">
        ↑ Aperçu des styles visuels — la vidéo finale inclut transitions, montage et musique synchronisée
      </p>
    </motion.div>
  );
}
