import { motion } from "framer-motion";
import { ArrowRight, Tv, Film, Music, Layers } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AnimatedSection from "./AnimatedSection";
import showcaseSeries from "@/assets/showcase-series.jpg";
import showcaseFilm from "@/assets/showcase-film.jpg";
import showcaseMusic from "@/assets/showcase-musicvideo.jpg";
import showcaseHybrid from "@/assets/showcase-hybrid.jpg";

const useCases = [
  {
    icon: Tv,
    title: "Séries",
    subtitle: "Multi-épisodes, multi-saisons",
    description: "Importez votre bible, vos scripts et vos références. Le studio extrait les personnages, planifie les épisodes et assure la continuité narrative sur l'ensemble de la série.",
    input: "Scripts + Bible + Références visuelles",
    output: "Épisodes montés avec continuité garantie",
    image: showcaseSeries,
    gradient: "from-primary/20 to-accent/10",
  },
  {
    icon: Film,
    title: "Films",
    subtitle: "Courts et longs métrages",
    description: "Du logline au rendu final. Structurez en actes, générez chaque scène, validez la qualité et assemblez un montage cinématique prêt à l'export.",
    input: "Scénario + Concept visuel",
    output: "Film complet avec finishing professionnel",
    image: showcaseFilm,
    gradient: "from-accent/20 to-primary/10",
  },
  {
    icon: Music,
    title: "Clips musicaux",
    subtitle: "Synchronisés au BPM",
    description: "Uploadez votre audio, décrivez le concept. L'IA analyse le rythme, synchronise les transitions et génère un clip visuellement cohérent calé sur la musique.",
    input: "Audio + Concept + Lyrics",
    output: "Clip synchronisé et exporté",
    image: showcaseMusic,
    gradient: "from-primary/15 to-destructive/10",
  },
  {
    icon: Layers,
    title: "Vidéo hybride",
    subtitle: "Transformation + stylisation",
    description: "Partez d'une vidéo existante et transformez-la. Ajoutez des effets IA, changez le style visuel, enrichissez avec de nouvelles scènes générées.",
    input: "Vidéo source + Direction artistique",
    output: "Vidéo transformée et enrichie",
    image: showcaseHybrid,
    gradient: "from-accent/15 to-primary/10",
  },
];

export default function UseCases() {
  const navigate = useNavigate();

  return (
    <section id="use-cases" className="py-20 sm:py-32 px-4">
      <div className="container mx-auto">
        <AnimatedSection variant="blurIn">
          <div className="text-center mb-16 sm:mb-20">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-4">Workflows</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Quatre formats,
              <br />
              <span className="text-primary">un seul studio</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Chaque type de projet bénéficie d'un pipeline dédié, optimisé pour son format.
            </p>
          </div>
        </AnimatedSection>

        <div className="space-y-12 sm:space-y-16">
          {useCases.map((uc, index) => (
            <AnimatedSection
              key={uc.title}
              variant={index % 2 === 0 ? "fadeLeft" : "fadeRight"}
              delay={0.1}
            >
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className={`relative rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-hidden group`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${uc.gradient} opacity-50`} />

                <div className={`relative flex flex-col ${index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"} items-stretch`}>
                  {/* Image */}
                  <div className="md:w-2/5 relative overflow-hidden">
                    <motion.img
                      src={uc.image}
                      alt={uc.title}
                      className="w-full h-48 sm:h-64 md:h-full object-cover"
                      loading="lazy"
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.6 }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-card/60 hidden md:block" />
                    <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent md:hidden" />
                  </div>

                  {/* Content */}
                  <div className="md:w-3/5 p-6 sm:p-8 md:p-10 flex flex-col justify-center relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center shadow-lg">
                        <uc.icon className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div>
                        <h3 className="text-xl sm:text-2xl font-bold">{uc.title}</h3>
                        <p className="text-sm text-muted-foreground">{uc.subtitle}</p>
                      </div>
                    </div>

                    <p className="text-muted-foreground mb-6 leading-relaxed">{uc.description}</p>

                    {/* Input → Output */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
                      <div className="flex-1 rounded-lg bg-background/60 border border-border/30 px-4 py-2.5">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Input</p>
                        <p className="text-sm font-medium">{uc.input}</p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-primary shrink-0 rotate-90 sm:rotate-0" />
                      <div className="flex-1 rounded-lg bg-primary/5 border border-primary/20 px-4 py-2.5">
                        <p className="text-[10px] uppercase tracking-widest text-primary mb-1">Output</p>
                        <p className="text-sm font-medium">{uc.output}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => navigate("/create")}
                      className="inline-flex items-center gap-2 text-sm text-primary font-medium group/link"
                    >
                      Créer ce type de projet
                      <ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </motion.div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
