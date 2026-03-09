import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import AnimatedSection from "./AnimatedSection";
import { Star } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const avatarColors = ["bg-primary/80", "bg-accent/80", "bg-destructive/60"];

const testimonials = [
  {
    name: "Léa M.",
    role: "Artiste indépendante",
    text: "J'ai créé mon premier clip en 10 minutes. Le résultat m'a bluffée, surtout la cohérence visuelle entre les scènes.",
    stars: 5,
  },
  {
    name: "Thomas R.",
    role: "Créateur de contenu",
    text: "Enfin un outil simple pour faire des vidéos sans savoir monter. J'utilise CineClip pour tous mes projets YouTube maintenant.",
    stars: 5,
  },
  {
    name: "Camille D.",
    role: "Musicienne",
    text: "Le style anime est incroyable. Mon clip a eu 3x plus de vues que d'habitude. Et tout ça sans budget vidéo.",
    stars: 4,
  },
];

const highlights = [
  {
    title: "Tout-en-un, sans compétence technique",
    text: "Décrivez votre idée, uploadez votre musique, et l'IA s'occupe de tout : plans, transitions et montage final.",
    icon: "🎬",
  },
  {
    title: "Résultat en quelques minutes",
    text: "Pas besoin d'attendre des heures. Votre vidéo complète est prête en 5 à 15 minutes, avec un suivi en temps réel.",
    icon: "⚡",
  },
  {
    title: "Votre style, votre univers",
    text: "Cinématique, anime, aquarelle, néon… 13 styles visuels pour créer exactement ce que vous imaginez.",
    icon: "🎨",
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
  const cardsY = useTransform(scrollYProgress, [0, 1], ["50px", "-30px"]);

  return (
    <section ref={sectionRef} id="proof" className="py-24 px-4 relative overflow-hidden">
      {/* Parallax glow */}
      <motion.div
        style={{ y: glowY, scale: glowScale }}
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/10 rounded-full blur-3xl"
      />

      <div className="container mx-auto relative z-10">
        {/* Counters */}
        <motion.div style={{ y: countersY }}>
          <AnimatedSection>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center space-y-2">
                  <div className="text-primary">
                    <Counter target={stat.value} suffix={stat.suffix} />
                  </div>
                  <p className="text-muted-foreground text-lg">{stat.label}</p>
                </div>
              ))}
            </div>
          </AnimatedSection>
        </motion.div>

        {/* Testimonials */}
        <AnimatedSection delay={0.1}>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Ce qu'en disent nos premiers utilisateurs
          </h2>
          <p className="text-center text-muted-foreground mb-10 max-w-xl mx-auto">
            Des créateurs comme vous ont déjà testé CineClip AI pendant notre bêta.
          </p>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-6 mb-20">
          {testimonials.map((t, i) => (
            <AnimatedSection key={t.name} delay={0.08 * (i + 1)}>
              <motion.div
                whileHover={{ y: -4 }}
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
                <div>
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </motion.div>
            </AnimatedSection>
          ))}
        </div>

        {/* Why CineClip */}
        <AnimatedSection delay={0.15}>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Pourquoi choisir CineClip AI ?
          </h2>
        </AnimatedSection>

        <motion.div style={{ y: cardsY }} className="grid md:grid-cols-3 gap-6">
          {highlights.map((h, i) => (
            <AnimatedSection key={h.title} delay={0.1 * (i + 1)}>
              <motion.div
                whileHover={{ y: -6, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-6 h-full flex flex-col"
              >
                <span className="text-3xl mb-4">{h.icon}</span>
                <h3 className="font-semibold text-foreground text-lg mb-2">{h.title}</h3>
                <p className="text-muted-foreground leading-relaxed flex-1">{h.text}</p>
              </motion.div>
            </AnimatedSection>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
