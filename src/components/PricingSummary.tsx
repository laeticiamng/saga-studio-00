import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Coins } from "lucide-react";
import { motion } from "framer-motion";
import AnimatedSection, { StaggerContainer, StaggerItem } from "./AnimatedSection";

const PLANS = [
  {
    name: "Auteur",
    price: "99 €",
    period: "/mois",
    credits: 500,
    features: [
      "2 projets actifs",
      "Ingestion + Extraction canonique",
      "Timeline + Rough Cut",
      "Export Full HD (1080p)",
    ],
    highlight: false,
  },
  {
    name: "Production",
    price: "499 €",
    period: "/mois",
    credits: 3000,
    features: [
      "10 projets actifs",
      "Fine Cut + Finishing",
      "Export 4K · Multi-provider",
      "Diagnostics avancés",
      "Priorité de génération",
    ],
    highlight: true,
  },
  {
    name: "Studio",
    price: "999 €",
    period: "/mois",
    credits: 10000,
    features: [
      "Projets illimités",
      "Export 4K HDR",
      "QC complet + Anti-aberration",
      "Contrôle de continuité",
      "Support dédié",
    ],
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
            <h2>Trois plans, un studio complet</h2>
            <p>Pour les créateurs, les équipes et les studios.</p>
            <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm text-foreground/90">
              <Coins className="h-4 w-4 text-primary" />
              <span><strong>1 projet complet offert</strong> à l'inscription · sans carte bancaire</span>
            </div>
          </div>
        </AnimatedSection>

        <StaggerContainer staggerDelay={0.1} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
          {PLANS.map((plan) => (
            <StaggerItem key={plan.name} variant="fadeUp">
              <motion.div
                whileHover={{ y: -6, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`rounded-2xl border bg-card/60 backdrop-blur-sm p-7 h-full flex flex-col relative ${
                  plan.highlight
                    ? "border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/5"
                    : "border-border/40"
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs bg-primary text-primary-foreground px-4 py-1 rounded-full font-medium">
                    Recommandé
                  </span>
                )}

                <div className="mb-5">
                  <h3 className="text-xl font-bold tracking-tight">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1.5">
                    <Coins className="h-3 w-3 text-primary" /> {plan.credits.toLocaleString("fr-FR")} crédits / mois
                  </p>
                </div>

                <ul className="space-y-2.5 mb-7 flex-1">
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
          className="text-center mt-10"
        >
          <Button variant="link" className="text-muted-foreground" onClick={() => navigate("/pricing")}>
            Voir tous les détails, packs de crédits et offre entreprise <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
