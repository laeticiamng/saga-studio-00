import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sparkles, Video, Zap, Film, Tv, Music, Layers } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import heroImage from "@/assets/hero-cinema.jpg";
import HeroDemo from "./HeroDemo";

const Hero = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const ref = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "15%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  const handleGetStarted = () => {
    navigate(user ? "/create" : "/auth?signup");
  };

  return (
    <section ref={ref} className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden py-20 sm:py-0">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-hero" />

      {/* Background image with parallax */}
      <motion.div
        style={{ y: bgY }}
        className="absolute inset-0 opacity-15"
      >
        <img
          src={heroImage}
          alt=""
          loading="eager"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 noise-overlay" />
      </motion.div>

      {/* Multi-glow ambient orbs */}
      <motion.div
        animate={{ scale: [1, 1.12, 1], opacity: [0.12, 0.22, 0.12] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 sm:w-[28rem] h-72 sm:h-[28rem] rounded-full blur-[100px] motion-reduce:hidden"
        style={{ background: "hsl(35 100% 55% / 0.2)" }}
      />
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.08, 0.15, 0.08] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute top-1/3 left-1/3 -translate-x-1/2 w-48 sm:w-80 h-48 sm:h-80 rounded-full blur-[80px] motion-reduce:hidden"
        style={{ background: "hsl(15 100% 50% / 0.15)" }}
      />

      {/* Content */}
      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative z-10 container mx-auto px-4 text-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] mb-6 sm:mb-8 max-w-[90vw] shadow-[0_2px_16px_rgba(0,0,0,0.2)]"
        >
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm text-muted-foreground">
            Votre premier projet offert — Aucune carte bancaire requise
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-foreground via-foreground/90 to-foreground/60 bg-clip-text text-transparent"
        >
          Le studio audiovisuel IA
          <br />
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">pour films, séries et clips</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="text-base sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-8 sm:mb-12 px-2"
        >
          Scénarisez, générez, montez et exportez des productions complètes.
          <br className="hidden md:block" />
          <span className="text-foreground/80">Du storyboard au rendu final — tout en un seul outil.</span>
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <Button variant="hero" size="lg" className="group" onClick={handleGetStarted}>
            <Video className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Créer un projet — Essai gratuit
          </Button>
          <Button variant="glass" size="lg" onClick={() => navigate(user ? "/dashboard" : "/pricing")}>
            <Zap className="w-5 h-5" />
            {user ? "Mes projets" : "Voir les tarifs"}
          </Button>
        </motion.div>

        {/* Capability pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="mt-10 sm:mt-16 flex flex-wrap justify-center gap-3 sm:gap-4"
        >
          {[
            { icon: Film, label: "Films & Courts-métrages" },
            { icon: Tv, label: "Séries multi-épisodes" },
            { icon: Music, label: "Clips musicaux" },
            { icon: Layers, label: "Timeline & Montage" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-full px-3 py-1.5">
              <item.icon className="w-3.5 h-3.5 text-primary" />
              <span>{item.label}</span>
            </div>
          ))}
        </motion.div>
        <HeroDemo />
      </motion.div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </section>
  );
};

export default Hero;
