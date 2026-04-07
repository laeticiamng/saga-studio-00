import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { Film, Users, Palette, Layers } from "lucide-react";

const stats = [
  { icon: Film, value: 12500, suffix: "+", label: "Projets produits", duration: 2 },
  { icon: Users, value: 3200, suffix: "+", label: "Créateurs actifs", duration: 2.2 },
  { icon: Palette, value: 13, suffix: "", label: "Styles visuels", duration: 1.5 },
  { icon: Layers, value: 6, suffix: " étapes", label: "Pipeline complet", duration: 1.2 },
];

function Counter({ value, suffix, duration }: { value: number; suffix: string; duration: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = Date.now();
    const end = start + duration * 1000;
    const step = () => {
      const now = Date.now();
      const progress = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(eased * value));
      if (now < end) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, value, duration]);

  return (
    <span ref={ref}>
      {display.toLocaleString("fr-FR")}{suffix}
    </span>
  );
}

export default function AnimatedCounters() {
  return (
    <section className="py-10 sm:py-14 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] via-transparent to-accent/[0.03]" />
      <div className="container mx-auto relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center"
            >
              <stat.icon className="h-6 w-6 text-primary mx-auto mb-2" />
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
                <Counter value={stat.value} suffix={stat.suffix} duration={stat.duration} />
              </div>
              <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
