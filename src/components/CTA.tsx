import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Sparkles } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

const CTA = () => {
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Merci de votre intérêt !",
      description: "Nous vous contacterons dès que possible.",
    });
    setEmail("");
  };

  return (
    <section className="py-24 px-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10" />
      <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse delay-1000" />
      
      <div className="container mx-auto relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card/40 backdrop-blur-sm border border-border/50 mb-8">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">Rejoignez la liste d'attente</span>
          </div>
          
          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            Prêt à révolutionner
            <br />
            <span className="text-primary">vos créations vidéo ?</span>
          </h2>
          
          <p className="text-xl text-muted-foreground mb-12">
            Soyez parmi les premiers à accéder à la plateforme et créez des clips épiques dès aujourd'hui.
          </p>
          
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <Input 
              type="email"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1 bg-card/40 backdrop-blur-sm border-border/50"
            />
            <Button variant="hero" type="submit" size="lg">
              Commencer
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
          
          <p className="text-sm text-muted-foreground mt-6">
            Accès anticipé gratuit • Sans engagement • Annulation possible à tout moment
          </p>
        </div>
      </div>
    </section>
  );
};

export default CTA;
