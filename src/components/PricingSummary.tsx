import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Coins } from "lucide-react";
import { motion } from "framer-motion";
import AnimatedSection, { StaggerContainer, StaggerItem } from "./AnimatedSection";

const PLANS = [
  {
    name: "Gratuit",
    price: "0 €",
    period: "/mois",
    credits: 10,
    features: ["10 crédits offerts", "Exports en 720p", "Support communautaire"],
    highlight: false,
  },
  {
    name: "Pro",
    price: "19 €",
    period: "/mois",
    credits: 100,
    features: ["100 crédits/mois", "Full HD (1080p)", "Tous les styles", "Support email"],
    highlight: true,
  },
  {
    name: "Studio",
    price: "49 €",
    period: "/mois",
    credits: 500,
    features: ["500 crédits/mois", "Exports 4K", "Priorité de génération", "Support dédié"],
    highlight: false,
  },
];

export default function PricingSummary() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <section id="pricing" className="page-section relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.03] to-transparent" />
      <div className="container mx-auto relative z-10">
        <AnimatedSection variant="blurIn">
          <div className="page-header">
            <h2>Des tarifs simples</h2>
            <p>Commencez gratuitement. Passez au supérieur quand vous êtes prêt.</p>
          </div>
        </AnimatedSection>

        <StaggerContainer staggerDelay={0.1} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto">
          {PLANS.map((plan) => (
            <StaggerItem key={plan.name} variant="fadeUp">
              <motion.div
                whileHover={{ y: -6, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`rounded-xl border bg-card/60 backdrop-blur-sm p-6 h-full flex flex-col relative ${
                  plan.highlight
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border/50"
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs bg-primary text-primary-foreground px-3 py-1 rounded-full font-medium">
                    Recommandé
                  </span>
                )}

                <div className="text-center mb-4">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                    <Coins className="h-3 w-3 text-primary" /> {plan.credits} crédits
                  </p>
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={plan.highlight ? "hero" : "glass"}
                  className="w-full"
                  size="sm"
                  onClick={() => navigate(user ? "/pricing" : "/auth?signup")}
                >
                  {plan.highlight ? "Commencer" : "En savoir plus"}
                </Button>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-8"
        >
          <Button variant="link" className="text-muted-foreground" onClick={() => navigate("/pricing")}>
            Voir tous les détails et packs de crédits <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
