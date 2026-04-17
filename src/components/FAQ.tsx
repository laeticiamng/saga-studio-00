import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import AnimatedSection from "./AnimatedSection";

const faqs = [
  {
    q: "Qu'est-ce que Saga Studio ?",
    a: "Saga Studio est une plateforme de production audiovisuelle assistée par IA. Elle centralise l'ingestion de contenus, la génération, la validation qualité, le montage et l'export dans un même workflow.",
  },
  {
    q: "À qui s'adresse Saga Studio ?",
    a: "Aux studios créatifs, équipes contenu, créateurs vidéo, marques narratives et équipes de production qui veulent structurer un pipeline audiovisuel reproductible et accélérer la création de formats vidéo.",
  },
  {
    q: "Quel type de contenu peut-on produire ?",
    a: "Des clips musicaux, des formats narratifs courts, des séries multi-épisodes et des contenus de marque à forte composante visuelle. Chaque format dispose d'un pipeline dédié.",
  },
  {
    q: "Comment fonctionne le workflow ?",
    a: "Vous importez un script, un brief ou des documents. Le studio structure le projet, génère les éléments visuels, applique des contrôles qualité, puis vous laisse valider et ajuster avant le montage et l'export.",
  },
  {
    q: "Faut-il déjà avoir un script ou un brief ?",
    a: "Non, ce n'est pas obligatoire. Vous pouvez démarrer à partir d'une simple idée et utiliser les outils d'enrichissement, ou importer directement un script, une bible et des références si vous en disposez.",
  },
  {
    q: "Peut-on découvrir le produit avant de lancer un projet ?",
    a: "Oui. Vous pouvez parcourir le workflow, les modes de production et les sections du studio avant de créer un projet. La création d'un projet n'est requise que pour générer un livrable.",
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="page-section">
      <div className="container mx-auto max-w-3xl">
        <AnimatedSection>
          <div className="page-header">
            <h2>Questions fréquentes</h2>
            <p>Tout ce que vous devez savoir pour démarrer</p>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.1}>
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm px-6"
              >
                <AccordionTrigger className="text-left text-[15px] font-medium hover:no-underline py-5">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed pb-5">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </AnimatedSection>
      </div>
    </section>
  );
}
