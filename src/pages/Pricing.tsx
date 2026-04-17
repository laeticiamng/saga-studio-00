import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Coins, Loader2, ExternalLink, HelpCircle, ArrowRight, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { STRIPE_CONFIG, STRIPE_MODE } from "@/config/stripe";

/* ─── Feature categories per plan ─── */
interface PlanFeature { label: string; category?: string }

const PLANS: {
  name: string; slug: string; price: string; period: string; credits: number;
  subtitle: string; features: PlanFeature[]; cta: string; highlight: boolean;
  stripe_key: keyof typeof STRIPE_CONFIG.plans | null; product_id: string | null;
}[] = [
  {
    name: "Auteur",
    slug: "auteur",
    price: "99 €",
    period: "/mois",
    credits: 500,
    subtitle: "Pour les créateurs indépendants et les premiers projets professionnels.",
    features: [
      { label: "2 projets actifs", category: "Capacité" },
      { label: "Ingestion documentaire (DOCX, PDF)", category: "Ingestion" },
      { label: "Extraction canonique", category: "Ingestion" },
      { label: "Timeline + Rough Cut", category: "Production" },
      { label: "Review Gates", category: "Production" },
      { label: "Export Full HD (1080p)", category: "Export" },
      { label: "Diagnostics standard", category: "Qualité" },
      { label: "Support email", category: "Support" },
    ],
    cta: "Commencer avec Auteur",
    highlight: false,
    stripe_key: "auteur",
    product_id: STRIPE_CONFIG.plans.auteur.product_id,
  },
  {
    name: "Production",
    slug: "production",
    price: "499 €",
    period: "/mois",
    credits: 3000,
    subtitle: "Pour les équipes de production et les workflows multi-projets exigeants.",
    features: [
      { label: "10 projets actifs", category: "Capacité" },
      { label: "Tout le plan Auteur, plus :", category: "Base" },
      { label: "Fine Cut + Finishing", category: "Production" },
      { label: "Export 4K", category: "Export" },
      { label: "Multi-provider (Runway, Luma, Veo)", category: "Génération" },
      { label: "Gouvernance projet complète", category: "Qualité" },
      { label: "Diagnostics avancés", category: "Qualité" },
      { label: "Priorité de génération", category: "Performance" },
      { label: "Support prioritaire", category: "Support" },
    ],
    cta: "Passer en Production",
    highlight: true,
    stripe_key: "production",
    product_id: STRIPE_CONFIG.plans.production.product_id,
  },
  {
    name: "Studio",
    slug: "studio",
    price: "999 €",
    period: "/mois",
    credits: 10000,
    subtitle: "Pour les studios et les productions à fort volume avec exigences maximales.",
    features: [
      { label: "Projets illimités", category: "Capacité" },
      { label: "Tout le plan Production, plus :", category: "Base" },
      { label: "File d'attente prioritaire maximale", category: "Performance" },
      { label: "Export 4K HDR", category: "Export" },
      { label: "Anti-aberration multi-pass", category: "Qualité" },
      { label: "QC automatisé complet", category: "Qualité" },
      { label: "Contrôle de continuité", category: "Qualité" },
      { label: "Support dédié", category: "Support" },
      { label: "Onboarding personnalisé", category: "Support" },
    ],
    cta: "Passer en Studio",
    highlight: false,
    stripe_key: "studio",
    product_id: STRIPE_CONFIG.plans.studio.product_id,
  },
];

const PACKS = [
  { credits: 500,  price: "49 €",  price_id: STRIPE_CONFIG.packs[500].price_id },
  { credits: 2000, price: "149 €", price_id: STRIPE_CONFIG.packs[2000].price_id },
  { credits: 5000, price: "299 €", price_id: STRIPE_CONFIG.packs[5000].price_id },
];

export default function Pricing() {
  const { user, subscription, checkSubscription } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  usePageTitle("Tarifs");
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    if (success === "true") {
      toast({ title: "Paiement réussi !", description: "Vos crédits ont été mis à jour." });
      checkSubscription();
      navigate("/pricing", { replace: true });
    }
    if (canceled === "true") {
      toast({ title: "Paiement annulé", variant: "destructive" });
      navigate("/pricing", { replace: true });
    }
  }, [searchParams, toast, checkSubscription, navigate]);

  const handleCheckout = async (priceId: string, mode: "subscription" | "payment") => {
    if (!user) { navigate("/auth"); return; }
    if (loadingPriceId) return;
    setLoadingPriceId(priceId);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { price_id: priceId, mode },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Une erreur inattendue s'est produite";
      toast({ title: "Erreur de paiement", description: message, variant: "destructive" });
    } finally {
      setLoadingPriceId(null);
    }
  };

  const handleManageSubscription = async () => {
    if (portalLoading) return;
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Une erreur inattendue s'est produite";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setPortalLoading(false);
    }
  };

  const isCurrentPlan = (plan: typeof PLANS[0]) => {
    if (!plan.product_id) return !subscription.subscribed;
    return subscription.product_id === plan.product_id;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {STRIPE_MODE === "test" && (
        <div className="bg-accent/20 border-b border-accent/40 text-accent-foreground text-center text-xs py-2 px-4 font-medium">
          ⚠️ Mode Stripe TEST — aucun paiement réel ne sera effectué.
        </div>
      )}
      <main className="container mx-auto px-4 py-20 md:py-28">
        {/* ─── Header ─── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center mb-6"
        >
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
            Une plateforme de production,
            <br />
            <span className="text-primary">pas un gadget IA.</span>
          </h1>
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-center text-muted-foreground max-w-2xl mx-auto mb-16 text-base md:text-lg leading-relaxed"
        >
          Ingestion documentaire, extraction canonique, génération multi-provider,
          timeline, montage, finishing, review gates, QC, export — le tout dans un pipeline
          de production professionnel contrôlé de bout en bout.
        </motion.p>

        {/* ─── Trial banner ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="max-w-xl mx-auto mb-16 rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm p-5 text-center"
        >
          <p className="text-sm text-muted-foreground">
            <Sparkles className="inline h-4 w-4 text-primary mr-1.5 -mt-0.5" />
            <strong className="text-foreground">Essai Découverte</strong> — 10 crédits offerts pour tester, sans carte bancaire.
            <Button variant="link" size="sm" className="ml-1 text-primary p-0 h-auto" onClick={() => navigate("/auth?signup")}>
              Créer un compte <ArrowRight className="h-3 w-3 ml-0.5" />
            </Button>
          </p>
        </motion.div>

        {/* ─── Plan cards ─── */}
        <div className="grid gap-6 lg:gap-8 grid-cols-1 lg:grid-cols-3 max-w-6xl mx-auto mb-20">
          {PLANS.map((plan, i) => {
            const current = isCurrentPlan(plan);
            return (
              <motion.div
                key={plan.slug}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 * i }}
                whileHover={{ y: -4 }}
                className={`relative rounded-2xl border p-8 flex flex-col bg-card/60 backdrop-blur-sm transition-shadow ${
                  plan.highlight
                    ? "border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/5"
                    : "border-border/40"
                } ${current ? "ring-2 ring-green-500/30" : ""}`}
              >
                {plan.highlight && !current && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 text-xs font-medium">
                    Recommandé
                  </Badge>
                )}
                {current && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground px-4 py-1 text-xs font-medium">
                    Votre plan
                  </Badge>
                )}

                {/* Plan header */}
                <div className="mb-6">
                  <h3 className="text-2xl font-bold tracking-tight">{plan.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-5xl font-bold tracking-tight">{plan.price}</span>
                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-2">
                    <Coins className="h-4 w-4 text-primary" />
                    {plan.credits.toLocaleString("fr-FR")} crédits / mois
                  </p>
                </div>

                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                  {plan.subtitle}
                </p>

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f.label} className="flex items-start gap-2.5 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{f.label}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {current && subscription.subscribed ? (
                  <Button variant="glass" className="w-full" onClick={handleManageSubscription} disabled={portalLoading}>
                    {portalLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Gérer l'abonnement <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                ) : plan.stripe_key ? (
                  <Button
                    variant={plan.highlight ? "hero" : "glass"}
                    className="w-full"
                    size="lg"
                    onClick={() => handleCheckout(STRIPE_CONFIG.plans[plan.stripe_key!].price_id, "subscription")}
                    disabled={!!loadingPriceId}
                  >
                    {loadingPriceId === STRIPE_CONFIG.plans[plan.stripe_key!].price_id && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {plan.cta}
                  </Button>
                ) : null}
              </motion.div>
            );
          })}
        </div>

        {/* ─── Usage model explainer ─── */}
        <div className="max-w-3xl mx-auto mb-20">
          <h2 className="text-2xl font-bold text-center mb-3">Comment fonctionnent les crédits</h2>
          <div className="grid gap-4 sm:grid-cols-2 mt-8">
            {[
              { q: "Que couvre un crédit ?", a: "1 crédit ≈ 1 scène générée. Un clip de 2 min ≈ 15–25 crédits selon le moteur et la durée." },
              { q: "Les crédits se cumulent-ils ?", a: "Non. Chaque mois, votre solde est réinitialisé à l'allocation de votre plan." },
              { q: "Puis-je dépasser mon allocation ?", a: "Oui. Achetez des packs de crédits supplémentaires à tout moment, sans engagement." },
              { q: "Les packs expirent-ils ?", a: "Non. Les crédits achetés en pack restent dans votre solde jusqu'à utilisation." },
            ].map((item) => (
              <div key={item.q} className="rounded-xl border border-border/30 bg-card/30 p-5">
                <p className="text-sm font-semibold mb-1.5">{item.q}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Credit packs ─── */}
        <div className="max-w-3xl mx-auto mb-20">
          <h2 className="text-2xl font-bold text-center mb-2">Packs de crédits supplémentaires</h2>
          <p className="text-center text-muted-foreground mb-8 text-sm">Achat unique, sans abonnement. S'ajoutent à votre solde existant.</p>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            {PACKS.map((pack) => (
              <div key={pack.credits} className="rounded-xl border border-border/30 bg-card/30 p-5 flex flex-col items-center text-center">
                <Coins className="h-6 w-6 text-primary mb-2" />
                <span className="text-2xl font-bold">{pack.credits.toLocaleString("fr-FR")}</span>
                <span className="text-xs text-muted-foreground mb-4">crédits</span>
                <Button
                  variant="glass"
                  className="w-full"
                  onClick={() => handleCheckout(pack.price_id, "payment")}
                  disabled={!!loadingPriceId}
                >
                  {loadingPriceId === pack.price_id && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {pack.price}
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Enterprise CTA ─── */}
        <div className="max-w-2xl mx-auto text-center rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-10">
          <h2 className="text-2xl font-bold mb-3">Besoin d'un setup sur mesure ?</h2>
          <p className="text-muted-foreground text-sm mb-6 leading-relaxed max-w-lg mx-auto">
            Volumes de production élevés, onboarding personnalisé, intégrations sur mesure,
            SLA dédié — contactez notre équipe pour un devis adapté à votre studio.
          </p>
          <Button variant="glass" size="lg" onClick={() => navigate("/contact")}>
            Contactez-nous <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
