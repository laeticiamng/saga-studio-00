import { Upload, Wand2, Video, Download, Layers, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import AnimatedSection from "./AnimatedSection";
import stepDescribe from "@/assets/step-describe.jpg";
import stepGenerate from "@/assets/step-generate.jpg";
import stepPreview from "@/assets/step-preview.jpg";
import stepExport from "@/assets/step-export.jpg";

const steps = [
  { icon: Upload, number: "01", title: "Décrivez votre projet", description: "Choisissez le type (film, série, clip), rédigez votre brief, définissez vos personnages et l'univers visuel.", image: stepDescribe },
  { icon: Wand2, number: "02", title: "L'IA planifie et génère", description: "L'IA découpe en scènes, génère les plans, vérifie la qualité et corrige les aberrations automatiquement.", image: stepGenerate },
  { icon: Layers, number: "03", title: "Montez sur la timeline", description: "Assemblez le rough cut, validez chaque étape via les review gates, puis affinez en fine cut.", image: stepPreview },
  { icon: Download, number: "04", title: "Finishing & Export", description: "Appliquez un look cinématique, normalisez l'audio, puis exportez en multi-format avec QC intégré.", image: stepExport },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="page-section">
      <div className="container mx-auto">
        <AnimatedSection variant="blurIn">
          <div className="page-header">
            <h2>Du brief au rendu final</h2>
            <p>Un workflow de production complet en 4 étapes</p>
          </div>
        </AnimatedSection>

        <div className="space-y-16 sm:space-y-24 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <AnimatedSection
              key={index}
              delay={0.12 * (index + 1)}
              variant={index % 2 === 0 ? "fadeLeft" : "fadeRight"}
            >
              <div
                className={`flex flex-col gap-6 sm:gap-10 ${
                  index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                } items-center`}
              >
                <motion.div
                  className="flex-1 w-full"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <div className="relative rounded-xl overflow-hidden aspect-[16/10] shadow-glow border border-border/30">
                    <img
                      src={step.image}
                      alt={step.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
                    <div className="absolute top-4 left-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary bg-card/80 backdrop-blur-sm rounded-full px-3 py-1.5 border border-primary/20">
                        Étape {step.number}
                      </span>
                    </div>
                  </div>
                </motion.div>

                <div className={`flex-1 ${index % 2 === 0 ? "md:pl-4" : "md:pr-4"} text-center md:text-left`}>
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.12 * (index + 1), type: "spring" }}
                    className="inline-flex w-14 h-14 rounded-xl bg-gradient-primary items-center justify-center shadow-glow mb-4"
                  >
                    <step.icon className="w-7 h-7 text-primary-foreground" />
                  </motion.div>
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
