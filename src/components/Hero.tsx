import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sparkles, Video, Zap } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import heroImage from "@/assets/hero-cinema.jpg";

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
    navigate(user ? "/create/clip" : "/auth?signup");
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
        {/* Noise overlay on hero image */}
        <div className="absolute inset-0 noise-overlay" />
      </motion.div>

      {/* Multi-glow ambient orbs */}
      <motion.div
        animate={{ scale: [1, 1.12, 1], opacity: [0.12, 0.22, 0.12] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 sm:w-[28rem] h-72 sm:h-[28rem] rounded-full blur-[100px]"
        style={{ background: "hsl(35 100% 55% / 0.2)" }}
      />
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.08, 0.15, 0.08] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute top-1/3 left-1/3 -translate-x-1/2 w-48 sm:w-80 h-48 sm:h-80 rounded-full blur-[80px]"
        style={{ background: "hsl(15 100% 50% / 0.15)" }}
      />
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.06, 0.12, 0.06] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        className="absolute top-1/2 right-1/4 w-40 sm:w-72 h-40 sm:h-72 rounded-full blur-[100px]"
        style={{ background: "hsl(25 95% 53% / 0.12)" }}
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
            Votre premier clip offert — Aucune carte bancaire requise
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-foreground via-foreground/90 to-foreground/60 bg-clip-text text-transparent"
        >
          Transformez votre musique
          <br />
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">en clip vidéo avec l'IA</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="text-base sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-8 sm:mb-12 px-2"
        >
          Uploadez votre musique, choisissez un style visuel, et recevez une vidéo complète de 1 à 5 minutes.
          <br className="hidden md:block" />
          <span className="text-foreground/80">Aucune compétence en montage requise.</span>
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <Button variant="hero" size="lg" className="group" onClick={handleGetStarted}>
            <Video className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Essai gratuit — Créer ma vidéo
          </Button>
          <Button variant="glass" size="lg" onClick={() => navigate("/pricing")}>
            <Zap className="w-5 h-5" />
            Voir les tarifs
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="mt-10 sm:mt-16 flex flex-wrap justify-center gap-4 sm:gap-8 text-xs sm:text-sm text-muted-foreground"
        >
          {["Qualité HD et 4K", "13 styles visuels au choix", "Vidéo prête en ~10 min"].map((t) => (
            <div key={t} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary/80" />
              <span>{t}</span>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Bottom fade for section transition */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </section>
  );
};

export default Hero;
