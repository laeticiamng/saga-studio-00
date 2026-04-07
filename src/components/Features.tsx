import { Card } from "@/components/ui/card";
import { Film, Users, Music, Wand2, Shield, Eye, Palette, Download, Layers } from "lucide-react";
import { motion } from "framer-motion";
import AnimatedSection, { StaggerContainer, StaggerItem } from "./AnimatedSection";

const features = [
  { icon: Film, title: "Films & Séries complètes", description: "Courts-métrages, longs-métrages ou séries multi-épisodes avec continuité narrative garantie.", gradient: "from-primary to-accent" },
  { icon: Layers, title: "Timeline & Montage", description: "Multi-pistes (vidéo, dialogue, musique, FX) avec rough cut et fine cut.", gradient: "from-accent to-primary", popular: true },
  { icon: Users, title: "Personnages persistants", description: "Identités visuelles cohérentes via des packs de référence et mémoire inter-épisodes.", gradient: "from-primary to-accent" },
  { icon: Music, title: "Clips sync BPM", description: "Transitions et actions synchronisées au rythme avec analyse audio intégrée.", gradient: "from-accent to-primary" },
  { icon: Shield, title: "Anti-aberrations", description: "Détection et correction automatique des problèmes d'anatomie, continuité et cohérence.", gradient: "from-primary to-accent" },
  { icon: Eye, title: "Review Gates", description: "Validez chaque étape — identité, scènes, rough cut, fine cut — avant de continuer.", gradient: "from-accent to-primary" },
  { icon: Palette, title: "Finishing & Look", description: "Look cinématique unifié, normalisation audio et colorimétrie professionnelle.", gradient: "from-primary to-accent" },
  { icon: Download, title: "Export multi-format", description: "1080p, 4K, 9:16 social — QC obligatoire et versioning intégré.", gradient: "from-accent to-primary" },
  { icon: Wand2, title: "13+ styles visuels", description: "Cinématique, anime, aquarelle, néon, noir… appliqués de façon cohérente sur tout le projet.", gradient: "from-primary to-accent" },
];

const Features = () => {
  return (
    <section id="features" className="py-20 sm:py-32 px-4 relative">
      <div className="container mx-auto">
        <AnimatedSection variant="blurIn">
          <div className="text-center mb-14 sm:mb-18">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-4">Capacités</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Un studio complet,
              <br />
              <span className="text-primary">pas un générateur</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              De la scénarisation au rendu final — chaque étape est couverte.
            </p>
          </div>
        </AnimatedSection>

        <StaggerContainer staggerDelay={0.05} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {features.map((feature, index) => (
            <StaggerItem key={index} variant="scaleIn">
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <Card className="relative p-6 bg-card/60 border-border/25 hover:border-primary/20 transition-all duration-300 group h-full overflow-hidden backdrop-blur-sm">
                  {feature.popular && (
                    <span className="absolute top-4 right-4 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/15">
                      Central
                    </span>
                  )}

                  <div className="relative z-10">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300`}>
                      <feature.icon className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                  </div>
                </Card>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
};

export default Features;
