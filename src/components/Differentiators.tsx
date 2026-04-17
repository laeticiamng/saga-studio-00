import { motion } from "framer-motion";
import {
  Brain,
  ShieldCheck,
  FileStack,
  GitBranch,
  Clapperboard,
  Gauge,
} from "lucide-react";
import AnimatedSection, { StaggerContainer, StaggerItem } from "./AnimatedSection";

const diffs = [
  {
    icon: FileStack,
    title: "Comprend vos documents",
    brief: "Pas un simple générateur de prompts",
    description: "Importez scripts, bibles ou one-pagers. L'IA lit votre corpus et construit le projet à partir de vos documents existants.",
  },
  {
    icon: ShieldCheck,
    title: "Qualité validée automatiquement",
    brief: "Détection des défauts visuels",
    description: "Chaque plan est analysé : anatomie, cohérence visuelle, continuité narrative. Les erreurs sont détectées avant le montage.",
  },
  {
    icon: GitBranch,
    title: "Vrai pipeline de production",
    brief: "Du brouillon au master final",
    description: "Brouillon de montage → version affinée → finishing → export. Un véritable workflow de post-production, pas des clips isolés.",
  },
  {
    icon: Brain,
    title: "Continuité entre épisodes",
    brief: "Mémoire de série",
    description: "Personnages, décors et arcs narratifs restent cohérents d'un épisode à l'autre, sans recommencer à zéro.",
  },
  {
    icon: Clapperboard,
    title: "Timeline multi-pistes",
    brief: "Comme un vrai logiciel de montage",
    description: "Vidéo, dialogue, musique, effets — assemblez sur une vraie timeline avec des points de validation à chaque étape.",
  },
  {
    icon: Gauge,
    title: "Exports prêts à diffuser",
    brief: "Vérifiés avant livraison",
    description: "1080p, 4K, formats verticaux 9:16. Chaque export passe un contrôle qualité avec versions et empreinte d'intégrité.",
  },
];

export default function Differentiators() {
  return (
    <section className="py-20 sm:py-32 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent" />

      <div className="container mx-auto relative z-10">
        <AnimatedSection variant="blurIn">
          <div className="text-center mb-16 sm:mb-20">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-4">Différence</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Pourquoi ce n'est pas
              <br />
              <span className="text-primary">un simple outil IA</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Saga Studio est un système de production complet, pas un générateur de clips.
            </p>
          </div>
        </AnimatedSection>

        <StaggerContainer staggerDelay={0.08} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 max-w-5xl mx-auto">
          {diffs.map((d) => (
            <StaggerItem key={d.title} variant="scaleIn">
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="group rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm p-6 h-full hover:border-primary/25 transition-all duration-300"
              >
                <div className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">
                  <d.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-1">{d.title}</h3>
                <p className="text-sm text-primary/80 font-medium mb-3">{d.brief}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{d.description}</p>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
