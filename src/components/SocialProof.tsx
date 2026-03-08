import { motion, useMotionValue, useTransform, animate, useScroll } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
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
  { value: 500, suffix: "+", label: "Vidéos créées en bêta" },
  { value: 50, suffix: "+", label: "Créateurs early-access" },
  { value: 95, suffix: "%", label: "Taux de satisfaction" },
];

const testimonials = [
  {
    name: "Marie L.",
    role: "Réalisatrice indépendante",
    text: "CineClip AI a transformé ma façon de prototyper mes projets. Le résultat est bluffant pour un outil aussi simple.",
    rating: 5,
  },
  {
    name: "Thomas D.",
    role: "Créateur YouTube",
    text: "La cohérence visuelle entre les plans est impressionnante. Un vrai gain de temps pour mes previsualisations.",
    rating: 5,
  },
  {
    name: "Sofia R.",
    role: "Directrice artistique",
    text: "L'un des meilleurs outils de création vidéo IA que j'ai testé. La qualité cinématique est au rendez-vous.",
    rating: 4,
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

        {/* Testimonials heading */}
        <AnimatedSection delay={0.15}>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Ce que disent nos créateurs
          </h2>
        </AnimatedSection>

        {/* Cards with parallax drift */}
        <motion.div style={{ y: cardsY }} className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <AnimatedSection key={t.name} delay={0.1 * (i + 1)}>
              <motion.div
                whileHover={{ y: -6, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-6 h-full flex flex-col"
              >
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-foreground/90 mb-6 flex-1 leading-relaxed">"{t.text}"</p>
                <div>
                  <p className="font-semibold text-foreground">{t.name}</p>
                  <p className="text-sm text-muted-foreground">{t.role}</p>
                </div>
              </motion.div>
            </AnimatedSection>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
