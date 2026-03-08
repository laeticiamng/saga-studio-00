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
    <section className="py-24 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10" />
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.3, 0.15] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/2 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl"
      />
      <motion.div
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.15, 0.3, 0.15] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute top-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl"
      />

      <div className="container mx-auto relative z-10">
        <AnimatedSection>
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card/40 backdrop-blur-sm border border-border/50 mb-8">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">10 crédits offerts, sans engagement</span>
            </div>

            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              Créez votre première vidéo
              <br />
              <span className="text-primary">en quelques minutes</span>
            </h2>

            <p className="text-xl text-muted-foreground mb-12">
              Décrivez votre idée, uploadez votre musique, et laissez l'IA faire le reste.
              <br className="hidden md:block" />
              Aucune compétence technique, aucun logiciel à installer.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                variant="hero"
                size="lg"
                className="group"
                onClick={() => navigate(user ? "/create/clip" : "/auth")}
              >
                <Video className="w-5 h-5 group-hover:scale-110 transition-transform" />
                Essai gratuit — Créer ma vidéo
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="glass" size="lg" onClick={() => navigate("/pricing")}>
                Voir les tarifs
              </Button>
            </div>

            <p className="text-sm text-muted-foreground mt-8">
              Aucune carte bancaire requise • Sans engagement • Résultat en ~10 minutes
            </p>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
};

export default CTA;
