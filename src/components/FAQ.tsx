import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import AnimatedSection from "./AnimatedSection";

const faqs = [
  {
    q: "Qu'est-ce que CineClip AI exactement ?",
    a: "CineClip AI est une plateforme en ligne qui génère des clips vidéo et courts-métrages complets grâce à l'intelligence artificielle. Vous décrivez votre projet, uploadez votre musique ou scénario, et l'IA produit une vidéo avec un style visuel cohérent.",
  },
  {
    q: "Ai-je besoin de compétences en montage vidéo ?",
    a: "Non, aucune compétence technique n'est requise. Vous remplissez un formulaire simple (titre, description, musique, style) et l'IA s'occupe de tout le reste : création des scènes, montage et export.",
  },
  {
    q: "Combien coûte la génération d'une vidéo ?",
    a: "Chaque vidéo consomme des crédits (le nombre dépend de la durée et du modèle choisi). Vous recevez 10 crédits gratuits à l'inscription. Ensuite, vous pouvez souscrire un abonnement (à partir de 19 €/mois) ou acheter des packs de crédits ponctuels.",
  },
  {
    q: "Dans quels formats puis-je exporter ?",
    a: "Vous pouvez exporter en format paysage (16:9) ou portrait (9:16), en qualité allant de 720p à 4K selon votre plan. Les vidéos sont au format MP4, compatible avec toutes les plateformes (YouTube, TikTok, Instagram…).",
  },
  {
    q: "Combien de temps dure la génération ?",
    a: "Cela dépend de la durée de la vidéo et du modèle IA sélectionné. En général, un clip de quelques minutes est prêt en 5 à 15 minutes. Vous pouvez suivre la progression en temps réel.",
  },
  {
    q: "Mes données et fichiers sont-ils protégés ?",
    a: "Oui. Vos fichiers (musiques, images, vidéos générées) sont stockés de manière sécurisée et ne sont jamais partagés avec des tiers. Vous pouvez supprimer vos données à tout moment. Consultez notre politique de confidentialité pour plus de détails.",
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
