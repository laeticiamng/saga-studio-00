import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle, BookOpen, MessageSquare, Film, Layers, Shield, Upload, Download, Palette, Tv, Music, ArrowRight } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import AnimatedSection, { StaggerContainer, StaggerItem } from "@/components/AnimatedSection";

const categories = [
  {
    icon: Film,
    title: "Projets & Création",
    faqs: [
      { q: "Quels types de projets puis-je créer ?", a: "Quatre types : Film (court ou long-métrage), Série (multi-épisodes avec continuité), Clip Musical (synchronisé au BPM) et Vidéo Hybride (vidéo existante + améliorations IA)." },
      { q: "Puis-je créer un projet à partir de documents existants ?", a: "Oui ! Le wizard de création propose un mode 'Depuis vos documents' qui ingère vos scripts, bibles, PDF et références pour pré-remplir automatiquement le projet." },
      { q: "Combien de temps faut-il pour générer un projet ?", a: "Environ 5 à 15 minutes pour un court-métrage de 2 minutes. Les séries et projets plus longs prennent proportionnellement plus de temps." },
    ],
  },
  {
    icon: Layers,
    title: "Timeline & Montage",
    faqs: [
      { q: "Qu'est-ce que le rough cut et le fine cut ?", a: "Le rough cut est le premier assemblage automatique de vos scènes. Le fine cut est la version affinée après vos ajustements manuels. Chaque étape a une review gate dédiée." },
      { q: "Puis-je modifier le montage manuellement ?", a: "Oui, le Timeline Studio offre une timeline multi-pistes (vidéo, dialogue, musique, FX) avec des outils de trim, remplacement de plans et réorganisation." },
    ],
  },
  {
    icon: Shield,
    title: "Qualité & Validation",
    faqs: [
      { q: "Comment fonctionne le contrôle qualité IA ?", a: "Chaque plan passe par un système anti-aberrations qui détecte les problèmes d'anatomie, de continuité et de cohérence narrative. Les plans défaillants sont automatiquement corrigés ou reroutés." },
      { q: "Que sont les review gates ?", a: "Ce sont 6 checkpoints de validation humaine tout au long du pipeline : identité, monde, scènes, rough cut, fine cut et export. Vous gardez le contrôle à chaque transition." },
    ],
  },
  {
    icon: Download,
    title: "Export & Formats",
    faqs: [
      { q: "Dans quels formats puis-je exporter ?", a: "1080p master, 720p preview, 9:16 social et 4K selon votre plan. Chaque export passe par un QC obligatoire avec versioning intégré, au format MP4." },
      { q: "Qu'est-ce que le finishing ?", a: "Le finishing applique un look cinématique unifié, normalise l'audio et ajuste la colorimétrie avant l'export final — comme en post-production professionnelle." },
    ],
  },
  {
    icon: Upload,
    title: "Documents & Ingestion",
    faqs: [
      { q: "Quels types de fichiers sont acceptés ?", a: "PDF, DOCX, images (JPEG/PNG), audio (MP3/WAV) et vidéo. Le système classe automatiquement chaque document (script, bible, concept, etc.)." },
      { q: "L'extraction est-elle toujours correcte ?", a: "L'extraction IA est accompagnée d'un score de confiance. Vous pouvez accepter, modifier ou rejeter chaque valeur extraite — l'utilisateur reste toujours en contrôle." },
    ],
  },
];

const quickLinks = [
  { icon: BookOpen, title: "Changelog", description: "Suivez les dernières nouveautés", href: "/changelog" },
  { icon: MessageSquare, title: "Contact", description: "Envoyez-nous un message", href: "/contact" },
  { icon: Film, title: "Créer un projet", description: "Lancez votre premier projet", href: "/create" },
];

export default function Help() {
  usePageTitle("Aide & Support — Saga Studio");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-4xl px-4 py-16 md:py-24">
        <AnimatedSection variant="blurIn">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">Support</p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Comment pouvons-nous
              <br />
              <span className="text-primary">vous aider ?</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Trouvez rapidement les réponses à vos questions ou contactez notre équipe.
            </p>
          </div>
        </AnimatedSection>

        {/* Quick links */}
        <StaggerContainer staggerDelay={0.08} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-14">
          {quickLinks.map((link) => (
            <StaggerItem key={link.title} variant="scaleIn">
              <Link to={link.href}>
                <Card className="border-border/30 bg-card/50 hover:border-primary/25 transition-all h-full group">
                  <CardContent className="p-5 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <link.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm mb-0.5 flex items-center gap-1">
                        {link.title}
                        <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </h3>
                      <p className="text-xs text-muted-foreground">{link.description}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* FAQ by category */}
        <div className="space-y-8">
          {categories.map((cat, ci) => (
            <AnimatedSection key={cat.title} variant="fadeUp" delay={0.08 * ci}>
              <div className="mb-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <cat.icon className="w-4 h-4 text-primary" />
                </div>
                <h2 className="text-lg font-semibold">{cat.title}</h2>
              </div>
              <Accordion type="single" collapsible className="space-y-2">
                {cat.faqs.map((faq, fi) => (
                  <AccordionItem
                    key={fi}
                    value={`${ci}-${fi}`}
                    className="rounded-xl border border-border/30 bg-card/50 px-5"
                  >
                    <AccordionTrigger className="text-left text-sm font-medium hover:no-underline py-4">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-sm leading-relaxed pb-4">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </AnimatedSection>
          ))}
        </div>

        {/* CTA */}
        <AnimatedSection variant="fadeUp" delay={0.3}>
          <Card className="mt-14 border-primary/20 bg-primary/5">
            <CardContent className="p-8 text-center">
              <HelpCircle className="w-10 h-10 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Vous ne trouvez pas la réponse ?</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Notre équipe est là pour vous aider. Envoyez-nous un message et nous vous répondrons rapidement.
              </p>
              <Button variant="hero" asChild>
                <Link to="/contact" className="gap-2">
                  <MessageSquare className="w-4 h-4" /> Nous contacter
                </Link>
              </Button>
            </CardContent>
          </Card>
        </AnimatedSection>
      </main>
      <Footer />
    </div>
  );
}
