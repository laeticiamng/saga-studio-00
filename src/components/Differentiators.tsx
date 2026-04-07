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
    title: "Document-aware",
    brief: "Pas un simple prompt-to-video",
    description: "Importez scripts, bibles, one-pagers. L'IA comprend votre corpus et construit le projet à partir de vos documents existants.",
  },
  {
    icon: ShieldCheck,
    title: "Qualité validée",
    brief: "Anti-aberrations intégré",
    description: "Chaque plan est scanné : anatomie, continuité, cohérence narrative. Les erreurs sont détectées et corrigées avant d'entrer dans la timeline.",
  },
  {
    icon: GitBranch,
    title: "Pipeline de production",
    brief: "Pas un générateur isolé",
    description: "Rough cut → Fine cut → Finishing → Export. Un vrai workflow de post-production, pas des clips générés sans lien.",
  },
  {
    icon: Brain,
    title: "Continuité narrative",
    brief: "Mémoire inter-épisodes",
    description: "Les personnages, décors et arcs narratifs sont tracés d'un épisode à l'autre. La série reste cohérente sur toute sa durée.",
  },
  {
    icon: Clapperboard,
    title: "Timeline & montage",
    brief: "Multi-pistes professionnel",
    description: "Vidéo, dialogue, musique, FX — assemblez sur une timeline réelle avec des review gates à chaque étape de validation.",
  },
  {
    icon: Gauge,
    title: "Export production-grade",
    brief: "Masters prêts à diffuser",
    description: "1080p, 4K, 9:16 social. Chaque export passe par un QC obligatoire avec versioning et checksum intégré.",
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
