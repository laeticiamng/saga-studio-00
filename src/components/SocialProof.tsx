import { motion } from "framer-motion";
import AnimatedSection, { StaggerContainer, StaggerItem } from "./AnimatedSection";
import { Shield, Layers, Eye, Download, FileText, Brain, Clapperboard } from "lucide-react";

const signals = [
  { icon: Shield, text: "Détection automatique des défauts visuels" },
  { icon: FileText, text: "Comprend vos scripts et documents" },
  { icon: Brain, text: "Continuité narrative entre épisodes" },
  { icon: Layers, text: "Timeline multi-pistes (vidéo, audio, FX)" },
  { icon: Eye, text: "6 points de validation humaine" },
  { icon: Clapperboard, text: "Finishing & normalisation audio" },
  { icon: Download, text: "Exports vérifiés avant livraison" },
];

export default function SocialProof() {
  return (
    <section className="py-16 sm:py-24 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] via-transparent to-accent/[0.03]" />

      <div className="container mx-auto relative z-10">
        <AnimatedSection variant="blurIn">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-4">Architecture</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Conçu pour la production
              <span className="text-primary"> professionnelle</span>
            </h2>
            <p className="text-muted-foreground text-base max-w-2xl mx-auto">
              Une infrastructure pensée pour la qualité, pas un simple générateur de clips.
            </p>
          </div>
        </AnimatedSection>

        <StaggerContainer staggerDelay={0.06} className="flex flex-wrap justify-center gap-3 sm:gap-4 max-w-4xl mx-auto">
          {signals.map((s) => (
            <StaggerItem key={s.text} variant="scaleIn">
              <motion.div
                whileHover={{ scale: 1.05, y: -2 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-full border border-border/40 bg-card/50 backdrop-blur-sm text-sm"
              >
                <s.icon className="w-4 h-4 text-primary shrink-0" />
                <span className="text-foreground/80">{s.text}</span>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
