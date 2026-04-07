import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Loader2, CheckCircle, Mail, MessageSquare, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { motion } from "framer-motion";
import AnimatedSection from "@/components/AnimatedSection";

export default function Contact() {
  usePageTitle("Contact — Saga Studio");
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(user?.user_metadata?.display_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [subject, setSubject] = useState("general");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) return;
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("send-contact", {
        body: { name, email, subject, message },
      });
      if (error) throw error;
      setSent(true);
      toast({ title: "Message envoyé !", description: "Nous vous répondrons dans les plus brefs délais." });
    } catch (err: unknown) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible d'envoyer le message.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-4xl px-4 py-16 md:py-24">
        <AnimatedSection variant="blurIn">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">Contact</p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Une question ?
              <br />
              <span className="text-primary">Parlons-en.</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Projet, partenariat, support technique ou simple curiosité — nous répondons généralement sous 24h.
            </p>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {/* Info cards */}
          <div className="space-y-4 md:col-span-1">
            <AnimatedSection variant="fadeLeft" delay={0.1}>
              <Card className="border-border/30 bg-card/50">
                <CardContent className="p-5 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">Email</h3>
                    <p className="text-sm text-muted-foreground">contact@sagastudio.ai</p>
                  </div>
                </CardContent>
              </Card>
            </AnimatedSection>

            <AnimatedSection variant="fadeLeft" delay={0.15}>
              <Card className="border-border/30 bg-card/50">
                <CardContent className="p-5 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">Réponse rapide</h3>
                    <p className="text-sm text-muted-foreground">Généralement sous 24h ouvrées</p>
                  </div>
                </CardContent>
              </Card>
            </AnimatedSection>

            <AnimatedSection variant="fadeLeft" delay={0.2}>
              <Card className="border-border/30 bg-card/50">
                <CardContent className="p-5 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <HelpCircle className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">Support technique</h3>
                    <p className="text-sm text-muted-foreground">Sélectionnez "Support" dans le formulaire</p>
                  </div>
                </CardContent>
              </Card>
            </AnimatedSection>
          </div>

          {/* Form */}
          <AnimatedSection variant="fadeRight" delay={0.1} className="md:col-span-2">
            {sent ? (
              <Card className="border-primary/20 bg-card/60">
                <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  >
                    <CheckCircle className="w-16 h-16 text-primary" />
                  </motion.div>
                  <h3 className="text-xl font-semibold">Message envoyé !</h3>
                  <p className="text-muted-foreground text-center max-w-sm">
                    Merci pour votre message. Notre équipe vous répondra dans les plus brefs délais.
                  </p>
                  <Button variant="outline" onClick={() => { setSent(false); setMessage(""); }}>
                    Envoyer un autre message
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border/30 bg-card/60">
                <CardHeader>
                  <CardTitle className="text-lg">Envoyez-nous un message</CardTitle>
                  <CardDescription>Tous les champs sont obligatoires.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nom</Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subject">Sujet</Label>
                      <Select value={subject} onValueChange={setSubject}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">Question générale</SelectItem>
                          <SelectItem value="support">Support technique</SelectItem>
                          <SelectItem value="partnership">Partenariat</SelectItem>
                          <SelectItem value="billing">Facturation</SelectItem>
                          <SelectItem value="feedback">Retour d'expérience</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <Textarea
                        id="message"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Décrivez votre demande..."
                        rows={5}
                        className="resize-none"
                        required
                      />
                    </div>
                    <Button type="submit" variant="hero" className="w-full" disabled={loading || !name || !email || !message}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                      {loading ? "Envoi en cours..." : "Envoyer le message"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </AnimatedSection>
        </div>
      </main>
      <Footer />
    </div>
  );
}
