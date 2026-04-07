import { motion } from "framer-motion";
import {
  Upload,
  FileSearch,
  Wand2,
  ScanEye,
  Layers,
  CheckCircle,
  Palette,
  Download,
} from "lucide-react";
import AnimatedSection, { StaggerContainer, StaggerItem } from "./AnimatedSection";

const steps = [
  {
    icon: Upload,
    title: "Importez",
    description: "Scripts, bibles, références, audio — uploadez votre corpus existant.",
    color: "text-primary",
  },
  {
    icon: FileSearch,
    title: "Extraction",
    description: "L'IA analyse, classe et extrait titre, synopsis, personnages et structure.",
    color: "text-primary",
  },
  {
    icon: Wand2,
    title: "Planification",
    description: "Découpage en scènes, shotlist et prompts générés automatiquement.",
    color: "text-primary",
  },
  {
    icon: ScanEye,
    title: "Génération",
    description: "Plans générés avec validation anti-aberrations en temps réel.",
    color: "text-primary",
  },
  {
    icon: Layers,
    title: "Montage",
    description: "Timeline multi-pistes — rough cut puis fine cut avec review gates.",
    color: "text-primary",
  },
  {
    icon: CheckCircle,
    title: "Validation",
    description: "QC automatique : continuité, anatomie, cohérence narrative.",
    color: "text-primary",
  },
  {
    icon: Palette,
    title: "Finishing",
    description: "Look cinématique unifié, normalisation audio, colorimétrie.",
    color: "text-primary",
  },
  {
    icon: Download,
    title: "Export",
    description: "Multi-format (1080p, 4K, 9:16) avec versioning et QC final.",
    color: "text-primary",
  },
];

export default function PipelineShowcase() {
  return (
    <section id="pipeline" className="py-20 sm:py-32 px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />

      <div className="container mx-auto relative z-10">
        <AnimatedSection variant="blurIn">
          <div className="text-center mb-16 sm:mb-20">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-4">Pipeline</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Du corpus brut
              <br />
              <span className="text-primary">au master final</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              8 étapes orchestrées par l'IA. Chaque transition est validée avant de passer à la suivante.
            </p>
          </div>
        </AnimatedSection>

        {/* Pipeline steps */}
        <div className="max-w-6xl mx-auto">
          <StaggerContainer staggerDelay={0.08} className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            {steps.map((step, i) => (
              <StaggerItem key={step.title} variant="scaleIn">
                <motion.div
                  whileHover={{ y: -6, scale: 1.03 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="relative group"
                >
                  <div className="rounded-xl border border-border/30 bg-card/60 backdrop-blur-sm p-5 sm:p-6 h-full flex flex-col items-center text-center transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_30px_-10px_hsl(35_100%_55%/0.15)]">
                    {/* Step number */}
                    <span className="absolute top-3 right-3 text-[10px] font-mono text-muted-foreground/50">
                      {String(i + 1).padStart(2, "0")}
                    </span>

                    <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <step.icon className={`w-6 h-6 ${step.color}`} />
                    </div>

                    <h3 className="font-semibold text-sm sm:text-base mb-2">{step.title}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>

                  {/* Connector arrow (hidden on last of each row) */}
                  {i < steps.length - 1 && (i + 1) % 4 !== 0 && (
                    <div className="hidden sm:block absolute top-1/2 -right-3 w-6 h-px bg-gradient-to-r from-primary/40 to-transparent" />
                  )}
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>

        {/* Bottom connector line */}
        <motion.div
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, delay: 0.5, ease: "easeOut" }}
          className="hidden sm:block mt-10 h-px max-w-4xl mx-auto origin-left"
          style={{ background: "linear-gradient(90deg, transparent, hsl(35 100% 55% / 0.3), hsl(25 95% 53% / 0.3), transparent)" }}
        />

        <AnimatedSection variant="fadeUp" delay={0.3}>
          <p className="text-center text-sm text-muted-foreground mt-8 max-w-xl mx-auto">
            Chaque étape dispose d'une <span className="text-foreground font-medium">review gate</span> —
            vous gardez le contrôle total sur le résultat à chaque transition.
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}
