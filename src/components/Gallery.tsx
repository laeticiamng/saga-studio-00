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

        <StaggerContainer staggerDelay={0.15} className="grid md:grid-cols-3 gap-8">
          {examples.map((example, index) => (
            <StaggerItem key={index} variant="scaleIn">
              <motion.div
                whileHover={{ y: -10, scale: 1.03 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="group relative rounded-xl overflow-hidden cursor-pointer"
              >
                <div className="aspect-[4/5] relative">
                  <motion.img
                    src={example.image}
                    alt={example.alt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    whileHover={{ scale: 1.08 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Play icon on hover */}
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                  >
                    <div className="h-16 w-16 rounded-full bg-primary/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:scale-100 scale-75 transition-all duration-300">
                      <Play className="h-7 w-7 text-primary-foreground ml-1" />
                    </div>
                  </motion.div>

                  <div className="absolute top-4 left-4">
                    <span className="inline-flex items-center gap-1 text-xs text-white/90 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1 font-medium">
                      Exemple
                    </span>
                  </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-6 text-white transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                  <h3 className="text-xl font-semibold mb-1">{example.title}</h3>
                  <div className="flex items-center gap-3 text-sm text-white/80">
                    <span>{example.style}</span>
                  </div>
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
