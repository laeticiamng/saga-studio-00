import { Upload, Wand2, Video, Download } from "lucide-react";
import AnimatedSection from "./AnimatedSection";

const steps = [
  { icon: Upload, number: "01", title: "Décrivez votre vision", description: "Expliquez votre histoire, uploadez votre visage et votre musique, définissez le style artistique." },
  { icon: Wand2, number: "02", title: "L'IA crée votre vidéo", description: "L'intelligence artificielle génère chaque scène de votre clip avec un style visuel uniforme du début à la fin." },
  { icon: Video, number: "03", title: "Prévisualisez et ajustez", description: "Visionnez votre création et affinez les détails si nécessaire avant l'export final." },
  { icon: Download, number: "04", title: "Exportez et partagez", description: "Téléchargez votre vidéo finale en haute définition (jusqu'à 4K selon votre plan), prête à être publiée." },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24 px-4">
      <div className="container mx-auto">
        <AnimatedSection>
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Comment ça marche ?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              De l'idée à la réalité en quelques étapes simples
            </p>
          </div>
        </AnimatedSection>

        <div className="relative max-w-4xl mx-auto">
          <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-accent to-primary transform -translate-x-1/2" />

          {steps.map((step, index) => (
            <AnimatedSection key={index} delay={0.12 * (index + 1)}>
              <div
                className={`relative flex items-center gap-8 mb-16 last:mb-0 ${
                  index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                } flex-col`}
              >
                <div className={`flex-1 ${index % 2 === 0 ? "md:text-right" : "md:text-left"} text-center`}>
                  <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-3">
                    Étape {step.number}
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>

                <div className="relative z-10 w-20 h-20 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow">
                  <step.icon className="w-10 h-10 text-primary-foreground" />
                </div>

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
