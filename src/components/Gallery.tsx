import { useState } from "react";
import example1 from "@/assets/example-1.jpg";
import example2 from "@/assets/example-2.jpg";
import example3 from "@/assets/example-3.jpg";
import exampleAnime from "@/assets/example-anime.jpg";
import exampleWatercolor from "@/assets/example-watercolor.jpg";
import exampleNeon from "@/assets/example-neon.jpg";
import exampleNoir from "@/assets/example-noir.jpg";
import exampleAbstract from "@/assets/example-abstract.jpg";
import exampleRetro from "@/assets/example-retro.jpg";
import { motion, AnimatePresence } from "framer-motion";
import { Play } from "lucide-react";
import AnimatedSection, { StaggerContainer, StaggerItem } from "./AnimatedSection";

type StyleTag = "Tous" | "Cinématique" | "Anime" | "Artistique" | "Urbain" | "Rétro";

const examples = [
  { image: example1, title: "Clip musical futuriste", style: "Sci-Fi / Cyberpunk", tag: "Cinématique" as StyleTag, alt: "Clip cyberpunk généré par IA" },
  { image: exampleAnime, title: "Performance anime", style: "Anime", tag: "Anime" as StyleTag, alt: "Clip anime généré par IA" },
  { image: example2, title: "Animation cohérente", style: "Animation 3D", tag: "Anime" as StyleTag, alt: "Animation 3D par IA" },
  { image: exampleNeon, title: "Ambiance urbaine", style: "Néon Noir", tag: "Urbain" as StyleTag, alt: "Clip néon noir par IA" },
  { image: exampleWatercolor, title: "Ballade poétique", style: "Aquarelle", tag: "Artistique" as StyleTag, alt: "Clip aquarelle par IA" },
  { image: example3, title: "Court-métrage dramatique", style: "Cinématique réaliste", tag: "Cinématique" as StyleTag, alt: "Court-métrage cinématique par IA" },
  { image: exampleNoir, title: "Jazz intemporel", style: "Noir & Blanc", tag: "Rétro" as StyleTag, alt: "Clip noir et blanc par IA" },
  { image: exampleAbstract, title: "Trip visuel", style: "Abstrait", tag: "Artistique" as StyleTag, alt: "Clip abstrait par IA" },
  { image: exampleRetro, title: "Session vintage", style: "Rétro 70s", tag: "Rétro" as StyleTag, alt: "Clip rétro par IA" },
];

const filters: StyleTag[] = ["Tous", "Cinématique", "Anime", "Artistique", "Urbain", "Rétro"];

const Gallery = () => {
  const [active, setActive] = useState<StyleTag>("Tous");
  const filtered = active === "Tous" ? examples : examples.filter((e) => e.tag === active);

  return (
    <section id="gallery" className="page-section bg-gradient-to-b from-background to-secondary/20">
      <div className="container mx-auto">
        <AnimatedSection variant="blurIn">
          <div className="page-header">
            <h2>Voyez ce que l'IA peut créer</h2>
            <p>Explorez nos styles visuels — chaque image est un aperçu de clip généré par CineClip AI.</p>
          </div>
        </AnimatedSection>

        {/* Filter pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-8 sm:mb-12">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActive(f)}
              className={`text-sm px-4 py-2 rounded-full border transition-all duration-200 ${
                f === active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card/40 text-muted-foreground border-border/50 hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Grid with AnimatePresence */}
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 sm:gap-6">
          <AnimatePresence mode="popLayout">
            {filtered.map((example) => (
              <motion.div
                key={example.title}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.35 }}
                whileHover={{ y: -6 }}
                className="group relative rounded-xl overflow-hidden cursor-pointer shadow-card hover:shadow-card-hover transition-shadow duration-300"
              >
                <div className="aspect-[4/5] relative overflow-hidden">
                  <motion.img
                    src={example.image}
                    alt={example.alt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    width={960}
                    height={1200}
                    whileHover={{ scale: 1.04 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent opacity-70 group-hover:opacity-100 transition-opacity duration-300" />

                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-14 w-14 rounded-full bg-primary/20 backdrop-blur-xl border border-primary/30 flex items-center justify-center opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all duration-300 shadow-lg">
                      <Play className="h-6 w-6 text-primary ml-0.5" />
                    </div>
                  </div>

                  <div className="absolute top-3 left-3">
                    <span className="inline-flex items-center text-[11px] text-foreground/80 bg-background/40 backdrop-blur-md rounded-full px-2.5 py-1 font-medium border border-border/20">
                      {example.tag}
                    </span>
                  </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-5 text-foreground transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
                  <h3 className="text-lg font-semibold mb-0.5">{example.title}</h3>
                  <span className="text-sm text-muted-foreground">{example.style}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
};

export default Gallery;
