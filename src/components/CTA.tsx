import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Video } from "lucide-react";
import { motion } from "framer-motion";
import AnimatedSection from "./AnimatedSection";

const CTA = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <section className="page-section relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10" />
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.08, 0.16, 0.08] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/2 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-primary/15 rounded-full blur-[100px]"
      />
      <motion.div
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.08, 0.16, 0.08] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute top-1/4 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-accent/15 rounded-full blur-[100px]"
      />

      <div className="container mx-auto relative z-10">
        <AnimatedSection variant="blurIn">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] mb-8 shadow-[0_2px_16px_rgba(0,0,0,0.15)]"
            >
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Votre première vidéo offerte — sans engagement</span>
            </motion.div>

            <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 sm:mb-6">
              Prêt à donner vie
              <br />
              <span className="text-primary">à votre projet ?</span>
            </h2>

            <p className="text-base sm:text-xl text-muted-foreground mb-8 sm:mb-12 px-2">
              Clip, court-métrage ou série — décrivez votre vision et laissez l'IA produire votre vidéo en quelques minutes.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Button
                variant="hero"
                size="lg"
                className="group"
                onClick={() => navigate(user ? "/create/clip" : "/auth?signup")}
              >
                <Video className="w-5 h-5 group-hover:scale-110 transition-transform" />
                Essai gratuit — Créer mon projet
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="glass" size="lg" onClick={() => navigate("/pricing")}>
                Voir les tarifs
              </Button>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="text-sm text-muted-foreground mt-8"
            >
              1 projet complet offert • Sans engagement • Résultat en ~10 minutes
            </motion.p>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
};

export default CTA;
