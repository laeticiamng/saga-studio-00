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
    a: "Saga Studio est un studio de production audiovisuelle propulsé par l'IA. Vous pouvez créer des films, séries multi-épisodes, clips musicaux et vidéos hybrides — du brief initial au rendu final exporté, en passant par la planification de scènes, le montage timeline et le contrôle qualité automatique.",
  },
  {
    q: "Ai-je besoin de compétences en montage vidéo ?",
    a: "Non. Le studio gère automatiquement le découpage en scènes, la génération des plans, l'assemblage en rough cut et les corrections de qualité. Vous pouvez intervenir à chaque étape via les review gates pour valider, ajuster ou régénérer — mais ce n'est jamais obligatoire.",
  },
  {
    q: "Comment fonctionne le contrôle qualité IA ?",
    a: "Chaque image et vidéo générée passe par un système anti-aberrations qui détecte les problèmes d'anatomie, de continuité, de cohérence narrative et de cadrage. Les plans défaillants sont automatiquement corrigés ou reroutés vers un autre fournisseur avant d'entrer dans la timeline.",
  },
  {
    q: "Quels types de projets puis-je créer ?",
    a: "Quatre types : Film (court ou long-métrage), Série (multi-épisodes avec continuité), Clip Musical (synchronisé au BPM) et Vidéo Hybride (vidéo existante + améliorations IA). Chaque type a un pipeline adapté.",
  },
  {
    q: "Dans quels formats puis-je exporter ?",
    a: "Vous pouvez exporter en 1080p master, 720p preview, 9:16 social ou 4K selon votre plan. Chaque export passe par un QC obligatoire et un versionning intégré. Les fichiers sont au format MP4.",
  },
  {
    q: "Qu'est-ce qu'un rough cut et un fine cut ?",
    a: "Le rough cut est le premier assemblage automatique de vos scènes sur la timeline. Le fine cut est la version affinée après vos ajustements manuels (trim, remplacement de plans, réorganisation). Chaque étape a une review gate dédiée.",
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
