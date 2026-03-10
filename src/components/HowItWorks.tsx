import { Upload, Wand2, Video, Download } from "lucide-react";
import { motion } from "framer-motion";
import AnimatedSection from "./AnimatedSection";

const steps = [
  { icon: Upload, number: "01", title: "Décrivez votre vision", description: "Expliquez votre histoire, uploadez votre visage et votre musique, définissez le style artistique." },
  { icon: Wand2, number: "02", title: "L'IA crée votre vidéo", description: "L'intelligence artificielle génère chaque scène de votre clip avec un style visuel uniforme du début à la fin." },
  { icon: Video, number: "03", title: "Prévisualisez et ajustez", description: "Visionnez votre création et affinez les détails si nécessaire avant l'export final." },
  { icon: Download, number: "04", title: "Exportez et partagez", description: "Téléchargez votre vidéo finale en haute définition, prête à être publiée partout." },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="page-section">
      <div className="container mx-auto">
        <AnimatedSection variant="blurIn">
          <div className="page-header">
            <h2>Comment ça marche ?</h2>
            <p>De l'idée à la réalité en 4 étapes simples</p>
          </div>
        </AnimatedSection>

        <div className="relative max-w-4xl mx-auto">
          <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-accent to-primary transform -translate-x-1/2" />

          {steps.map((step, index) => (
            <AnimatedSection
              key={index}
              delay={0.12 * (index + 1)}
              variant={index % 2 === 0 ? "fadeLeft" : "fadeRight"}
            >
              <div
                className={`relative flex items-center gap-5 sm:gap-8 md:gap-12 mb-10 sm:mb-16 last:mb-0 ${
                  index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                } flex-col`}
              >
                <div className={`flex-1 ${index % 2 === 0 ? "md:text-right" : "md:text-left"} text-center`}>
                  <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-3">
                    Étape {step.number}
                  </div>
                  <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto md:mx-0">{step.description}</p>
                </div>

                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.12 * (index + 1) + 0.1, type: "spring", stiffness: 200 }}
                  className="relative z-10 w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow shrink-0"
                >
                  <step.icon className="w-8 h-8 md:w-10 md:h-10 text-primary-foreground" />
                </motion.div>

                <div className="flex-1 hidden md:block" />
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
