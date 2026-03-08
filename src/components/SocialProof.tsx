import { motion, useMotionValue, useTransform, animate, useScroll } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import AnimatedSection from "./AnimatedSection";

function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.floor(v).toLocaleString("fr-FR"));

  useEffect(() => {
    if (!hasAnimated) return;
    const controls = animate(count, target, { duration: 2, ease: "easeOut" });
    return controls.stop;
  }, [hasAnimated, target, count]);

  return (
    <motion.span
      ref={ref}
      onViewportEnter={() => setHasAnimated(true)}
      className="text-4xl md:text-5xl font-bold"
      style={{ fontFamily: "var(--font-display)" }}
    >
      <motion.span>{rounded}</motion.span>
      {suffix}
    </motion.span>
  );
}

const stats = [
  { value: 4, suffix: "", label: "Modèles IA intégrés" },
  { value: 13, suffix: "", label: "Styles visuels disponibles" },
  { value: 5, suffix: " min", label: "Durée max par vidéo" },
];

const highlights = [
  {
    title: "Tout-en-un, sans compétence technique",
    text: "Décrivez votre idée, uploadez votre musique, et l'IA s'occupe de tout : plans, transitions et montage final.",
    icon: "🎬",
  },
  {
    title: "Résultat en quelques minutes",
    text: "Pas besoin d'attendre des heures. Notre système génère votre vidéo complète rapidement, prête à télécharger.",
    icon: "⚡",
  },
  {
    title: "Plusieurs styles au choix",
    text: "Cinématique, anime, aquarelle, néon… Choisissez le style visuel qui correspond à votre univers.",
    icon: "🎨",
  },
];

export default function SocialProof() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  // Parallax: glow rises faster, cards drift subtly
  const glowY = useTransform(scrollYProgress, [0, 1], ["40px", "-60px"]);
  const glowScale = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1.2, 0.9]);
  const countersY = useTransform(scrollYProgress, [0, 1], ["30px", "-20px"]);
  const cardsY = useTransform(scrollYProgress, [0, 1], ["50px", "-30px"]);

  return (
    <section ref={sectionRef} id="proof" className="py-24 px-4 relative overflow-hidden">
      {/* Parallax glow */}
      <motion.div
        style={{ y: glowY, scale: glowScale }}
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/10 rounded-full blur-3xl"
      />

      <div className="container mx-auto relative z-10">
        {/* Counters with parallax */}
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

        {/* Highlights heading */}
        <AnimatedSection delay={0.15}>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Pourquoi CineClip AI ?
          </h2>
        </AnimatedSection>

        {/* Cards with parallax drift */}
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
