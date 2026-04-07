import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Zap, Shield, Layers, Film, Upload, Palette, Download, Bug, Wrench } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import AnimatedSection, { StaggerContainer, StaggerItem } from "@/components/AnimatedSection";

type ChangeType = "feature" | "improvement" | "fix";

const typeConfig: Record<ChangeType, { label: string; variant: "default" | "secondary" | "outline" }> = {
  feature: { label: "Nouveau", variant: "default" },
  improvement: { label: "Amélioration", variant: "secondary" },
  fix: { label: "Correction", variant: "outline" },
};

const changelog = [
  {
    version: "0.9.0",
    date: "Avril 2026",
    title: "Création depuis un corpus de documents",
    entries: [
      { type: "feature" as ChangeType, icon: Upload, text: "Wizard dual-path : créez un projet depuis zéro ou à partir de vos documents existants (scripts, bibles, PDF)" },
      { type: "feature" as ChangeType, icon: Sparkles, text: "Extraction automatique de titre, synopsis, personnages et structure depuis les documents uploadés" },
      { type: "feature" as ChangeType, icon: Shield, text: "Détection intelligente des informations manquantes avec questions ciblées" },
      { type: "improvement" as ChangeType, icon: Layers, text: "Redesign complet de la homepage avec sections use-cases, pipeline et différenciation" },
    ],
  },
  {
    version: "0.8.0",
    date: "Mars 2026",
    title: "Timeline Studio & Finishing",
    entries: [
      { type: "feature" as ChangeType, icon: Layers, text: "Timeline multi-pistes (vidéo, dialogue, musique, FX) avec rough cut et fine cut" },
      { type: "feature" as ChangeType, icon: Palette, text: "Finishing panel : look cinématique unifié, normalisation audio, colorimétrie" },
      { type: "feature" as ChangeType, icon: Download, text: "Export multi-format (1080p, 4K, 9:16 social) avec QC obligatoire et versioning" },
      { type: "improvement" as ChangeType, icon: Shield, text: "6 review gates humaines sur l'ensemble du pipeline" },
    ],
  },
  {
    version: "0.7.0",
    date: "Février 2026",
    title: "Continuité & Gouvernance",
    entries: [
      { type: "feature" as ChangeType, icon: Shield, text: "Continuity Center : mémoire narrative inter-épisodes avec graphe de nœuds" },
      { type: "feature" as ChangeType, icon: Zap, text: "Governance Dashboard : politiques, transitions et violations en temps réel" },
      { type: "feature" as ChangeType, icon: Bug, text: "Système anti-aberrations : détection anatomie, continuité, cohérence narrative" },
      { type: "fix" as ChangeType, icon: Wrench, text: "Correction du pipeline de reprise après échec sur étape spécifique" },
    ],
  },
  {
    version: "0.6.0",
    date: "Janvier 2026",
    title: "Séries multi-épisodes",
    entries: [
      { type: "feature" as ChangeType, icon: Film, text: "Création de séries multi-saisons avec gestion des épisodes" },
      { type: "feature" as ChangeType, icon: Sparkles, text: "Bible Manager : bibles de personnages, de style et de continuité" },
      { type: "feature" as ChangeType, icon: Zap, text: "Agent Dashboard : suivi des agents IA et de leurs exécutions" },
      { type: "improvement" as ChangeType, icon: Layers, text: "Autopilot : lancement automatisé du pipeline avec suivi en temps réel" },
    ],
  },
];

export default function Changelog() {
  usePageTitle("Changelog — Saga Studio");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-3xl px-4 py-16 md:py-24">
        <AnimatedSection variant="blurIn">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">Changelog</p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Quoi de neuf dans
              <br />
              <span className="text-primary">Saga Studio ?</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Suivez l'évolution de la plateforme — nouvelles fonctionnalités, améliorations et corrections.
            </p>
          </div>
        </AnimatedSection>

        <div className="space-y-10">
          {changelog.map((release, ri) => (
            <AnimatedSection key={release.version} variant="fadeUp" delay={0.1 * ri}>
              <Card className="border-border/30 bg-card/50 overflow-hidden">
                <div className="border-b border-border/20 px-6 py-4 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <Badge variant="default" className="text-xs font-mono">v{release.version}</Badge>
                    <h2 className="font-semibold text-lg">{release.title}</h2>
                  </div>
                  <span className="text-sm text-muted-foreground">{release.date}</span>
                </div>
                <CardContent className="p-6">
                  <StaggerContainer staggerDelay={0.05} className="space-y-3">
                    {release.entries.map((entry, i) => (
                      <StaggerItem key={i} variant="fadeUp">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            <entry.icon className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <Badge variant={typeConfig[entry.type].variant} className="text-[10px] px-1.5 py-0">
                                {typeConfig[entry.type].label}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">{entry.text}</p>
                          </div>
                        </div>
                      </StaggerItem>
                    ))}
                  </StaggerContainer>
                </CardContent>
              </Card>
            </AnimatedSection>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
