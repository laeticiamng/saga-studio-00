import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Film, Sparkles, Shield, Users, Send, CheckCircle, Loader2 } from "lucide-react";
import AnimatedSection from "@/components/AnimatedSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const values = [
  {
    icon: Sparkles,
    title: "Simplicité radicale",
    description: "Pas besoin de compétences en montage. Décrivez votre idée, et l'IA fait le reste.",
  },
  {
    icon: Film,
    title: "Qualité cinématique",
    description: "Chaque vidéo est générée avec une cohérence visuelle de bout en bout, comme un vrai film.",
  },
  {
    icon: Shield,
    title: "Données protégées",
    description: "Vos fichiers et créations sont sécurisés. Nous ne partageons jamais vos données avec des tiers.",
  },
  {
    icon: Users,
    title: "Pour tous les créateurs",
    description: "Musiciens, réalisateurs indépendants, créateurs de contenu — CineClip AI est fait pour vous.",
  },
];

function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast({ title: "Veuillez remplir tous les champs", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-contact", {
        body: { name: name.trim(), email: email.trim(), message: message.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSent(true);
      toast({ title: "Message envoyé !", description: "Nous vous répondrons sous 24 heures." });
    } catch (err: any) {
      toast({ title: "Erreur d'envoi", description: err.message || "Veuillez réessayer.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle className="h-10 w-10 text-primary" />
        <p className="text-lg font-semibold text-foreground">Merci pour votre message !</p>
        <p className="text-sm text-muted-foreground">Nous reviendrons vers vous rapidement.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
      <div className="space-y-2">
        <Label htmlFor="contact-name">Votre nom</Label>
        <Input id="contact-name" placeholder="Jean Dupont" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-email">Votre email</Label>
        <Input id="contact-email" type="email" placeholder="jean@example.com" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-message">Votre message</Label>
        <Textarea id="contact-message" placeholder="Décrivez votre question ou besoin…" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} rows={4} required />
      </div>
      <Button type="submit" className="w-full" disabled={sending}>
        {sending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Envoi en cours…</> : <><Send className="h-4 w-4 mr-2" /> Envoyer</>}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Ou écrivez-nous directement à <a href="mailto:contact@cineclip.ai" className="text-primary hover:underline">contact@cineclip.ai</a>
      </p>
    </form>
  );
}

export default function About() {
  usePageTitle("À propos");
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-3xl px-4 py-16">
        <AnimatedSection>
          <div className="text-center mb-16">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Film className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">À propos de CineClip AI</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Nous croyons que tout le monde devrait pouvoir créer des vidéos de qualité professionnelle, sans compétence technique et sans budget de production.
            </p>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.1}>
          <div className="space-y-6 mb-16">
            <h2 className="text-2xl font-bold">Notre mission</h2>
            <p className="text-muted-foreground leading-relaxed">
              CineClip AI est né d'un constat simple : produire une vidéo de qualité demande du temps, des compétences et des outils coûteux. Nous avons voulu changer cela.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Notre plateforme utilise l'intelligence artificielle pour transformer vos idées en vidéos complètes — clips musicaux, courts-métrages, contenus créatifs — en quelques minutes seulement. Vous décrivez, l'IA crée.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Que vous soyez musicien, créateur de contenu, réalisateur indépendant ou simplement curieux, CineClip AI met la création vidéo à votre portée.
            </p>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.2}>
          <h2 className="text-2xl font-bold mb-8">Nos valeurs</h2>
          <div className="grid sm:grid-cols-2 gap-6 mb-16">
            {values.map((v) => (
              <div key={v.title} className="rounded-xl border border-border/50 bg-card/60 p-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <v.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">{v.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{v.description}</p>
              </div>
            ))}
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.3}>
          <div className="rounded-xl border border-border/50 bg-card/60 p-8">
            <h2 className="text-2xl font-bold mb-2 text-center">Une question ?</h2>
            <p className="text-muted-foreground mb-6 text-center">
              Remplissez le formulaire ci-dessous. Nous répondons généralement sous 24 heures.
            </p>
            <ContactForm />
          </div>
        </AnimatedSection>
      </main>
      <Footer />
    </div>
  );
}
