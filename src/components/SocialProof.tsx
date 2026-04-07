import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import AnimatedSection, { StaggerContainer, StaggerItem } from "./AnimatedSection";
import { Star } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const avatarColors = ["bg-primary/80", "bg-accent/80", "bg-destructive/60"];

const testimonials = [
  {
    name: "Léa M.",
    role: "Réalisatrice indépendante",
    text: "J'ai produit un court-métrage complet en une journée. Le pipeline de validation IA m'a évité des heures de correction manuelle.",
    stars: 5,
  },
  {
    name: "Thomas R.",
    role: "Producteur de contenu",
    text: "La timeline multi-pistes et les review gates m'ont donné le contrôle d'un studio professionnel — sans l'équipe technique.",
    stars: 5,
  },
  {
    name: "Camille D.",
    role: "Musicienne",
    text: "Le mode clip musical avec sync BPM est magique. Mon clip a été validé, monté et exporté en moins de 20 minutes.",
    stars: 4,
  },
];

const highlights = [
  {
    title: "Studio complet, pas un jouet",
    text: "Personnages, scènes, timeline, montage, finishing, export — le pipeline complet d'un studio de production dans un seul outil.",
    icon: "🎬",
  },
  {
    title: "Qualité contrôlée à chaque étape",
    text: "Détection automatique des aberrations IA (anatomie, continuité, script) avec corrections et reroutage avant que les erreurs ne se propagent.",
    icon: "🛡️",
  },
  {
    title: "Du rough cut au master final",
    text: "Assemblez, validez, affinez et exportez en multi-format — le workflow classique du cinéma, piloté par l'IA.",
    icon: "🎞️",
  },
];

export default function SocialProof() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const glowY = useTransform(scrollYProgress, [0, 1], ["40px", "-60px"]);
  const glowScale = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1.2, 0.9]);

  return (
    <section ref={sectionRef} id="proof" className="page-section relative overflow-hidden">
      <motion.div
        style={{ y: glowY, scale: glowScale }}
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] sm:w-[600px] h-[150px] sm:h-[300px] bg-primary/10 rounded-full blur-3xl"
      />

      <div className="container mx-auto relative z-10">
        <AnimatedSection variant="blurIn" delay={0.1}>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Ce qu'en disent nos premiers utilisateurs
          </h2>
          <p className="text-center text-muted-foreground mb-10 max-w-xl mx-auto">
            Des créateurs professionnels utilisent Saga Studio pour produire des projets complets.
          </p>
        </AnimatedSection>

        <StaggerContainer staggerDelay={0.12} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-14 sm:mb-20">
          {testimonials.map((t, i) => (
            <StaggerItem key={t.name} variant="fadeUp">
              <motion.div
                whileHover={{ y: -6, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-6 h-full flex flex-col"
              >
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: 5 }).map((_, si) => (
                    <Star
                      key={si}
                      className={`h-4 w-4 ${si < t.stars ? "text-primary fill-primary" : "text-muted-foreground/30"}`}
                    />
                  ))}
                </div>
                <p className="text-foreground leading-relaxed flex-1 mb-4">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className={`${avatarColors[i % avatarColors.length]} text-white text-xs font-bold`}>
                      {t.name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        <AnimatedSection variant="blurIn" delay={0.15}>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Pourquoi choisir Saga Studio ?
          </h2>
        </AnimatedSection>

        <StaggerContainer staggerDelay={0.12} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {highlights.map((h) => (
            <StaggerItem key={h.title} variant="scaleIn">
              <motion.div
                whileHover={{ y: -6, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-6 h-full flex flex-col"
              >
                <span className="text-3xl mb-4">{h.icon}</span>
                <h3 className="font-semibold text-foreground text-lg mb-2">{h.title}</h3>
                <p className="text-muted-foreground leading-relaxed flex-1">{h.text}</p>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
