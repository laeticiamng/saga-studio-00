import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";
import { motion } from "framer-motion";
import AnimatedSection from "./AnimatedSection";

const CTA = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <section className="py-24 sm:py-36 px-4 relative overflow-hidden">
      {/* Cinematic background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/15 rounded-full blur-[150px] motion-reduce:hidden"
      />

      <div className="container mx-auto relative z-10">
        <AnimatedSection variant="blurIn">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-6 sm:mb-8 leading-[0.95]">
              Votre vision mérite
              <br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                un vrai studio
              </span>
            </h2>

            <p className="text-lg sm:text-xl text-muted-foreground mb-10 sm:mb-14 max-w-2xl mx-auto leading-relaxed">
              Arrêtez de générer des clips isolés. Produisez des œuvres complètes
              — du brief au master final, en un seul outil.
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
                className="group text-base px-8 py-6"
                onClick={() => navigate(user ? "/create" : "/auth?signup")}
              >
                <Play className="w-5 h-5 group-hover:scale-110 transition-transform fill-current" />
                Créer mon projet — Essai gratuit
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="glass" size="lg" className="text-base px-8 py-6" onClick={() => navigate("/pricing")}>
                Voir les tarifs
              </Button>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="text-sm text-muted-foreground mt-8"
            >
              Sans carte bancaire · Premier livrable en ~10 min
            </motion.p>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
};

export default CTA;
