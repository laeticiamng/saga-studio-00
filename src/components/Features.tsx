import { Card } from "@/components/ui/card";
import { Film, Users, Music, Sparkles, Wand2, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import AnimatedSection from "./AnimatedSection";

const features = [
  { icon: Film, title: "Vidéos longue durée", description: "Générez des clips de 4-5 minutes d'une seule traite, sans coupures ni interruptions.", gradient: "from-orange-500 to-red-500" },
  { icon: Sparkles, title: "Style uniforme garanti", description: "Un style artistique cohérent et des transitions fluides du début à la fin de votre vidéo.", gradient: "from-yellow-500 to-orange-500", popular: true },
  { icon: Users, title: "Personnalisation avancée", description: "Intégrez votre visage, choisissez le nombre de personnages et définissez leur apparence.", gradient: "from-amber-500 to-yellow-500" },
  { icon: Music, title: "Synchronisation musicale", description: "Uploadez votre bande son et l'IA synchronise parfaitement l'action avec la musique.", gradient: "from-orange-600 to-amber-500" },
  { icon: Wand2, title: "Styles illimités", description: "Du réalisme photo au dessin animé, créez dans le style artistique de votre choix.", gradient: "from-red-500 to-orange-600" },
  { icon: CheckCircle, title: "Export haute qualité", description: "Exportez de 720p à 4K selon votre plan. Rendu professionnel grâce à nos modèles IA de pointe.", gradient: "from-yellow-600 to-orange-500" },
];

const Features = () => {
  return (
    <section id="features" className="py-24 px-4 relative">
      <div className="container mx-auto">
        <AnimatedSection>
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Tout ce dont vous avez besoin pour créer
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Une plateforme complète avec les technologies les plus avancées du marché
            </p>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <AnimatedSection key={index} delay={0.08 * (index + 1)}>
              <motion.div whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                <Card className="relative p-6 bg-card/60 backdrop-blur-sm border-border/50 hover:border-primary/40 hover:shadow-[0_0_30px_-5px_hsl(35_100%_55%/0.15)] transition-all duration-500 group h-full overflow-hidden">
                  {/* Gradient border glow on hover */}
                  <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{ background: "linear-gradient(135deg, hsl(35 100% 55% / 0.08), transparent, hsl(25 95% 53% / 0.08))" }}
                  />

                  {/* Badges */}
                  {feature.popular && (
                    <span className="absolute top-4 right-4 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                      Populaire
                    </span>
                  )}
                  {(feature as any).isNew && (
                    <span className="absolute top-4 right-4 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/20">
                      Nouveau
                    </span>
                  )}

                  <div className="relative z-10">
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </div>
                </Card>
              </motion.div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
