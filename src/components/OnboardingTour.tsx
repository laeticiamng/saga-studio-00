import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Film, Upload, Palette, Zap, X } from "lucide-react";

const STEPS = [
  {
    icon: <Film className="h-8 w-8 text-primary" />,
    title: "Bienvenue sur CineClip AI !",
    description: "Créez des clips vidéo et courts-métrages grâce à l'intelligence artificielle. Voici comment ça marche.",
  },
  {
    icon: <Upload className="h-8 w-8 text-primary" />,
    title: "1. Décrivez votre projet",
    description: "Choisissez entre un Clip (avec votre musique) ou un Film (avec votre scénario). Sélectionnez un style visuel et lancez la création.",
  },
  {
    icon: <Palette className="h-8 w-8 text-primary" />,
    title: "2. L'IA crée votre vidéo",
    description: "L'IA génère automatiquement chaque scène, assure un style cohérent du début à la fin, et assemble le tout en une vidéo complète.",
  },
  {
    icon: <Zap className="h-8 w-8 text-primary" />,
    title: "3. Téléchargez le résultat",
    description: "Votre vidéo est prête ! Téléchargez-la en format paysage ou portrait. 10 crédits offerts pour démarrer, rechargeables à tout moment.",
  },
];

export function OnboardingTour() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!user) return;
    const key = `onboarding-done-${user.id}`;
    if (!localStorage.getItem(key)) {
      setShow(true);
    }
  }, [user]);

  const dismiss = () => {
    if (user) localStorage.setItem(`onboarding-done-${user.id}`, "true");
    setShow(false);
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      dismiss();
      navigate("/create/clip");
    }
  };

  if (!show) return null;

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-md border-border/50 bg-card/90 backdrop-blur mx-4">
        <CardContent className="pt-6 pb-6 text-center relative">
          <button onClick={dismiss} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            {current.icon}
          </div>
          <h2 className="text-xl font-bold mb-2">{current.title}</h2>
          <p className="text-muted-foreground mb-6">{current.description}</p>

          <div className="flex items-center justify-center gap-2 mb-4">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 w-8 rounded-full ${i <= step ? "bg-primary" : "bg-secondary"}`} />
            ))}
          </div>

          <div className="flex gap-3 justify-center">
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>Retour</Button>
            )}
            <Button variant="hero" onClick={next}>
              {step < STEPS.length - 1 ? "Suivant" : "C'est parti !"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
