import { motion } from "framer-motion";
import AnimatedSection from "./AnimatedSection";

const formats = [
  { name: "MP4", label: "MP4" },
  { name: "16:9", label: "16:9" },
  { name: "9:16", label: "9:16" },
  { name: "720p", label: "720p" },
  { name: "1080p", label: "1080p" },
  { name: "4K", label: "4K" },
];

const platforms = [
  { name: "YouTube" },
  { name: "TikTok" },
  { name: "Instagram" },
  { name: "Vimeo" },
];

export default function ClientLogos() {
  return (
    <section className="py-12 px-4 border-y border-border/30 relative overflow-hidden">
      <AnimatedSection>
        <p className="text-center text-sm text-muted-foreground mb-6 tracking-widest uppercase">
          Formats d'export disponibles
        </p>
      </AnimatedSection>

      <div className="flex flex-wrap justify-center gap-3 max-w-2xl mx-auto">
        {formats.map((f) => (
          <span
            key={f.name}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card/40 px-4 py-2 text-sm font-medium text-muted-foreground"
          >
            {f.label}
          </span>
        ))}
      </div>

      <AnimatedSection>
        <p className="text-center text-xs text-muted-foreground/60 mt-6">
          Compatible YouTube, TikTok, Instagram, Vimeo et toute plateforme vidéo
        </p>
      </AnimatedSection>
    </section>
  );
}
