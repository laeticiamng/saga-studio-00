import example1 from "@/assets/example-1.jpg";
import example2 from "@/assets/example-2.jpg";
import example3 from "@/assets/example-3.jpg";
import { motion } from "framer-motion";
import { Play } from "lucide-react";
import AnimatedSection from "./AnimatedSection";
import { useState } from "react";

const examples = [
  { image: example1, title: "Clip musical futuriste", style: "Sci-Fi / Cyberpunk", alt: "Exemple de clip musical futuriste généré par CineClip AI dans un style cyberpunk" },
  { image: example2, title: "Animation cohérente", style: "Animation 3D", alt: "Exemple d'animation 3D avec personnages cohérents générée par CineClip AI" },
  { image: example3, title: "Court-métrage dramatique", style: "Cinématique réaliste", alt: "Exemple de court-métrage dramatique au style cinématique réaliste par CineClip AI" },
];

const DEMO_VIDEO_URL = "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0";

const Gallery = () => {
  const [showDemo, setShowDemo] = useState(false);

  return (
    <section id="gallery" className="py-24 px-4 bg-gradient-to-b from-background to-secondary/20">
      <div className="container mx-auto">
        <AnimatedSection>
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Voyez ce que l'IA peut créer
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Ces images illustrent les styles visuels disponibles. Cliquez sur la démo pour voir un résultat en vidéo.
            </p>
          </div>
        </AnimatedSection>

        {/* Demo video section */}
        <AnimatedSection delay={0.05}>
          <div className="mb-16 max-w-3xl mx-auto">
            {!showDemo ? (
              <motion.button
                onClick={() => setShowDemo(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="relative w-full aspect-video rounded-2xl overflow-hidden group cursor-pointer border border-border/30"
              >
                <img
                  src={example1}
                  alt="Aperçu de la démo vidéo CineClip AI"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="h-7 w-7 text-primary-foreground ml-1" />
                    </div>
                    <span className="text-white font-semibold text-lg drop-shadow-md">
                      Voir la démo en vidéo
                    </span>
                    <span className="text-white/70 text-sm">
                      Découvrez un clip généré en quelques minutes
                    </span>
                  </div>
                </div>
              </motion.button>
            ) : (
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-border/30">
                <iframe
                  src={DEMO_VIDEO_URL}
                  title="Démo CineClip AI"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              </div>
            )}
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-8">
          {examples.map((example, index) => (
            <AnimatedSection key={index} delay={0.1 * (index + 1)}>
              <motion.div
                whileHover={{ y: -8 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="group relative rounded-xl overflow-hidden"
              >
                <div className="aspect-[4/5] relative">
                  <img
                    src={example.image}
                    alt={example.alt}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-300" />

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
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Gallery;
