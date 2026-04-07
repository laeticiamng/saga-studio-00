import { Upload, Wand2, Layers, Download } from "lucide-react";
import { motion } from "framer-motion";
import AnimatedSection from "./AnimatedSection";
import stepDescribe from "@/assets/step-describe.jpg";
import stepGenerate from "@/assets/step-generate.jpg";
import stepPreview from "@/assets/step-preview.jpg";
import stepExport from "@/assets/step-export.jpg";

const steps = [
  { icon: Upload, number: "01", title: "Importez ou décrivez", description: "Uploadez vos scripts, bibles et références — ou décrivez votre vision à partir de zéro. L'IA extrait et structure automatiquement.", image: stepDescribe },
  { icon: Wand2, number: "02", title: "L'IA planifie et génère", description: "Découpage en scènes, génération des plans, validation anti-aberrations et correction automatique.", image: stepGenerate },
  { icon: Layers, number: "03", title: "Montez et validez", description: "Assemblez sur la timeline, validez chaque étape via les review gates, affinez le montage.", image: stepPreview },
  { icon: Download, number: "04", title: "Finishing & Export", description: "Look cinématique unifié, normalisation audio, export multi-format avec QC intégré.", image: stepExport },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-20 sm:py-32 px-4">
      <div className="container mx-auto">
        <AnimatedSection variant="blurIn">
          <div className="text-center mb-14 sm:mb-20">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-4">Processus</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              4 étapes vers
              <br />
              <span className="text-primary">votre production</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Un workflow de production complet, du brief au rendu final.
            </p>
          </div>
        </AnimatedSection>

        <div className="space-y-14 sm:space-y-20 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <AnimatedSection
              key={index}
              delay={0.1 * (index + 1)}
              variant={index % 2 === 0 ? "fadeLeft" : "fadeRight"}
            >
              <div
                className={`flex flex-col gap-6 sm:gap-8 ${
                  index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                } items-center`}
              >
                <motion.div
                  className="flex-1 w-full"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <div className="relative rounded-xl overflow-hidden aspect-[16/10] border border-border/20">
                    <img
                      src={step.image}
                      alt={step.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
                    <div className="absolute top-4 left-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary bg-card/80 backdrop-blur-sm rounded-full px-3 py-1.5 border border-primary/20">
                        Étape {step.number}
                      </span>
                    </div>
                  </div>
                </motion.div>

                <div className={`flex-1 ${index % 2 === 0 ? "md:pl-4" : "md:pr-4"} text-center md:text-left`}>
                  <div className="inline-flex w-12 h-12 rounded-xl bg-gradient-primary items-center justify-center shadow-lg mb-4">
                    <step.icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-3">{step.title}</h3>
                  <p className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-md mx-auto md:mx-0">
                    {step.description}
                  </p>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
