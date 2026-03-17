import example1 from "@/assets/example-1.jpg";
import example2 from "@/assets/example-2.jpg";
import example3 from "@/assets/example-3.jpg";
import { motion } from "framer-motion";
import { Play } from "lucide-react";
import AnimatedSection, { StaggerContainer, StaggerItem } from "./AnimatedSection";

const examples = [
  { image: example1, title: "Clip musical futuriste", style: "Sci-Fi / Cyberpunk", alt: "Exemple de clip musical futuriste généré par CineClip AI dans un style cyberpunk" },
  { image: example2, title: "Animation cohérente", style: "Animation 3D", alt: "Exemple d'animation 3D avec personnages cohérents générée par CineClip AI" },
  { image: example3, title: "Court-métrage dramatique", style: "Cinématique réaliste", alt: "Exemple de court-métrage dramatique au style cinématique réaliste par CineClip AI" },
];

const Gallery = () => {
  return (
    <section id="gallery" className="page-section bg-gradient-to-b from-background to-secondary/20">
      <div className="container mx-auto">
        <AnimatedSection variant="blurIn">
          <div className="page-header">
            <h2>Voyez ce que l'IA peut créer</h2>
            <p>Ces images illustrent les styles visuels disponibles sur CineClip AI.</p>
          </div>
        </AnimatedSection>

        <StaggerContainer staggerDelay={0.12} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 sm:gap-8">
          {examples.map((example, index) => (
            <StaggerItem key={index} variant="scaleIn">
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="group relative rounded-xl overflow-hidden cursor-pointer shadow-card hover:shadow-card-hover transition-shadow duration-300"
              >
                <div className="aspect-[4/5] relative overflow-hidden">
                  <motion.img
                    src={example.image}
                    alt={example.alt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    whileHover={{ scale: 1.04 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                  {/* Gradient overlay — stronger on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-70 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Play icon on hover */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-14 w-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 flex items-center justify-center opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                      <Play className="h-6 w-6 text-white ml-0.5" />
                    </div>
                  </div>

                  <div className="absolute top-3 left-3">
                    <span className="inline-flex items-center text-[11px] text-white/80 bg-black/40 backdrop-blur-md rounded-full px-2.5 py-1 font-medium border border-white/[0.06]">
                      Exemple
                    </span>
                  </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 text-white transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
                  <h3 className="text-lg sm:text-xl font-semibold mb-0.5">{example.title}</h3>
                  <span className="text-sm text-white/60">{example.style}</span>
                </div>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
};

export default Gallery;
