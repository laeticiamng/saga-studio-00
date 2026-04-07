import { Card } from "@/components/ui/card";
import { Film, Users, Music, Sparkles, Wand2, CheckCircle, Layers, Shield, Palette, Download, Eye, Tv } from "lucide-react";
import { motion } from "framer-motion";
import AnimatedSection, { StaggerContainer, StaggerItem } from "./AnimatedSection";

const features = [
  { icon: Film, title: "Films & Séries complètes", description: "Produisez des courts-métrages, longs-métrages ou séries multi-épisodes avec continuité narrative garantie.", gradient: "from-orange-500 to-red-500" },
  { icon: Layers, title: "Timeline & Montage", description: "Assemblez vos scènes sur une timeline multi-pistes, ajustez le rough cut et peaufinez le fine cut.", gradient: "from-yellow-500 to-orange-500", popular: true },
  { icon: Users, title: "Personnages & Univers", description: "Créez des personnages persistants avec des packs de référence pour une identité visuelle cohérente.", gradient: "from-amber-500 to-yellow-500" },
  { icon: Music, title: "Clips musicaux sync", description: "Synchronisez l'action et les transitions au rythme de votre musique avec l'analyse BPM intégrée.", gradient: "from-orange-600 to-amber-500" },
  { icon: Shield, title: "Contrôle qualité IA", description: "Détection automatique des aberrations (anatomie, continuité, cohérence narrative) avant chaque étape.", gradient: "from-red-500 to-orange-600" },
  { icon: Eye, title: "Review Gates", description: "Validez chaque étape — identité, scènes, rough cut, fine cut — avant de passer à la suivante.", gradient: "from-yellow-500 to-amber-500" },
  { icon: Palette, title: "Finishing & Look", description: "Appliquez un look cinématique unifié, normalisez l'audio et ajustez la colorimétrie avant export.", gradient: "from-orange-500 to-yellow-600" },
  { icon: Download, title: "Export multi-format", description: "Exportez en 1080p, 4K, 9:16 social ou master — avec QC obligatoire et versioning intégré.", gradient: "from-red-500 to-amber-500" },
  { icon: Wand2, title: "13+ styles visuels", description: "Cinématique, anime, aquarelle, néon, noir… chaque style est appliqué de manière cohérente sur l'ensemble du projet.", gradient: "from-yellow-600 to-orange-500" },
];

const Features = () => {
  return (
    <section id="features" className="page-section relative">
      <div className="container mx-auto">
        <AnimatedSection variant="blurIn">
          <div className="page-header">
            <h2>Un studio complet, pas un simple générateur</h2>
            <p>De la scénarisation au rendu final — chaque étape est couverte</p>
          </div>
        </AnimatedSection>

        <StaggerContainer staggerDelay={0.06} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
          {features.map((feature, index) => (
            <StaggerItem key={index} variant="scaleIn">
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <Card className="relative p-6 bg-card/80 border-border/30 shadow-card hover:shadow-card-hover hover:border-primary/20 transition-all duration-300 group h-full overflow-hidden">
                  <div
                    className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{ background: "linear-gradient(135deg, hsl(35 100% 55% / 0.04), transparent 60%, hsl(25 95% 53% / 0.03))" }}
                  />
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent pointer-events-none" />

                  {feature.popular && (
                    <span className="absolute top-4 right-4 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/15">
                      Central
                    </span>
                  )}

                  <div className="relative z-10">
                    <div className={`w-11 h-11 rounded-lg bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-300 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.3)]`}>
                      <feature.icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
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
