import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Coins } from "lucide-react";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    credits: 10,
    features: ["10 credits/month", "720p exports", "Standard queue", "Community support"],
    cta: "Current Plan",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    credits: 100,
    features: ["100 credits/month", "1080p exports", "Priority queue", "All style presets", "Email support"],
    cta: "Upgrade to Pro",
    highlight: true,
  },
  {
    name: "Studio",
    price: "$49",
    period: "/month",
    credits: 500,
    features: ["500 credits/month", "4K exports", "Instant queue", "Custom style bible", "Character lock", "Dedicated support"],
    cta: "Go Studio",
    highlight: false,
  },
];

const PACKS = [
  { credits: 50, price: "$5" },
  { credits: 200, price: "$15" },
  { credits: 500, price: "$30" },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3">Simple Pricing</h1>
          <p className="text-lg text-muted-foreground">Choose a plan or buy credit packs</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto mb-16">
          {PLANS.map((plan) => (
            <Card key={plan.name} className={`border-border/50 bg-card/60 relative ${plan.highlight ? "border-primary ring-2 ring-primary/20" : ""}`}>
              {plan.highlight && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                  Most Popular
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
                <Button variant={plan.highlight ? "hero" : "glass"} className="w-full">
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
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
                  <Button variant="glass" size="sm">{pack.price}</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
