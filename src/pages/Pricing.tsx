import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Coins, Loader2, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Stripe IDs
const STRIPE_CONFIG = {
  plans: {
    pro: { price_id: "price_1T8iuNDFa5Y9NR1IBeXG2743", product_id: "prod_U6wn2kBSJMfs2u" },
    studio: { price_id: "price_1T8iuODFa5Y9NR1IfZhO5AgW", product_id: "prod_U6woFSbLwxv9a1" },
  },
  packs: {
    50: { price_id: "price_1T8iuPDFa5Y9NR1IjHDoP66d" },
    200: { price_id: "price_1T8iuQDFa5Y9NR1ICQoQPlsv" },
    500: { price_id: "price_1T8iuQDFa5Y9NR1Idek0xWg0" },
  },
};

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    credits: 10,
    features: ["10 credits/month", "720p exports", "Standard queue", "Community support"],
    cta: "Current Plan",
    highlight: false,
    stripe_key: null as string | null,
    product_id: null as string | null,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    credits: 100,
    features: ["100 credits/month", "1080p exports", "Priority queue", "All style presets", "Email support"],
    cta: "Upgrade to Pro",
    highlight: true,
    stripe_key: "pro" as const,
    product_id: STRIPE_CONFIG.plans.pro.product_id,
  },
  {
    name: "Studio",
    price: "$49",
    period: "/month",
    credits: 500,
    features: ["500 credits/month", "4K exports", "Instant queue", "Custom style bible", "Character lock", "Dedicated support"],
    cta: "Go Studio",
    highlight: false,
    stripe_key: "studio" as const,
    product_id: STRIPE_CONFIG.plans.studio.product_id,
  },
];

const PACKS = [
  { credits: 50, price: "$5", price_id: STRIPE_CONFIG.packs[50].price_id },
  { credits: 200, price: "$15", price_id: STRIPE_CONFIG.packs[200].price_id },
  { credits: 500, price: "$30", price_id: STRIPE_CONFIG.packs[500].price_id },
];

export default function Pricing() {
  const { user, subscription, checkSubscription } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast({ title: "Payment successful!", description: "Your credits have been updated." });
      checkSubscription();
    }
    if (searchParams.get("canceled") === "true") {
      toast({ title: "Payment canceled", variant: "destructive" });
    }
  }, [searchParams, toast, checkSubscription]);

  const handleCheckout = async (priceId: string, mode: "subscription" | "payment") => {
    if (!user) {
      navigate("/auth");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { price_id: priceId, mode },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast({ title: "Checkout error", description: err.message, variant: "destructive" });
    }
  };

  const handleManageSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const isCurrentPlan = (plan: typeof PLANS[0]) => {
    if (!plan.product_id) return !subscription.subscribed;
    return subscription.product_id === plan.product_id;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3">Simple Pricing</h1>
          <p className="text-lg text-muted-foreground">Choose a plan or buy credit packs</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto mb-16">
          {PLANS.map((plan) => {
            const current = isCurrentPlan(plan);
            return (
              <Card key={plan.name} className={`border-border/50 bg-card/60 relative ${plan.highlight ? "border-primary ring-2 ring-primary/20" : ""} ${current ? "ring-2 ring-green-500/40" : ""}`}>
                {plan.highlight && !current && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                    Most Popular
                  </Badge>
                )}
                {current && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white">
                    Your Plan
                  </Badge>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="mt-2">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <CardDescription className="flex items-center justify-center gap-1 mt-1">
                    <Coins className="h-4 w-4 text-primary" /> {plan.credits} credits
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary" /> {f}
                      </li>
                    ))}
                  </ul>
                  {current && subscription.subscribed ? (
                    <Button variant="glass" className="w-full" onClick={handleManageSubscription}>
                      Manage Subscription <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  ) : plan.stripe_key ? (
                    <Button
                      variant={plan.highlight ? "hero" : "glass"}
                      className="w-full"
                      onClick={() => handleCheckout(STRIPE_CONFIG.plans[plan.stripe_key!].price_id, "subscription")}
                    >
                      {plan.cta}
                    </Button>
                  ) : (
                    <Button variant="glass" className="w-full" disabled>
                      {current ? "Current Plan" : plan.cta}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-6">Credit Packs</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {PACKS.map((pack) => (
              <Card key={pack.credits} className="border-border/50 bg-card/40">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-2">
                    <Coins className="h-5 w-5 text-primary" />
                    <span className="font-medium">{pack.credits} credits</span>
                  </div>
                  <Button
                    variant="glass"
                    size="sm"
                    onClick={() => handleCheckout(pack.price_id, "payment")}
                  >
                    {pack.price}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
