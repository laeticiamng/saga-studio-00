import { Building2, Users, Video, Megaphone, Layers, Workflow } from "lucide-react";
import { motion } from "framer-motion";
import AnimatedSection from "./AnimatedSection";

const audiences = [
  {
    icon: Building2,
    title: "Studios créatifs",
    description: "Industrialiser la production de formats visuels sans sacrifier la direction artistique.",
  },
  {
    icon: Users,
    title: "Équipes contenu",
    description: "Produire plus vite des formats narratifs cohérents pour leurs marques ou plateformes.",
  },
  {
    icon: Video,
    title: "Créateurs vidéo",
    description: "Passer du script ou du brief au rendu final sans assembler dix outils.",
  },
  {
    icon: Megaphone,
    title: "Marques narratives",
    description: "Construire des formats vidéo récurrents avec une identité visuelle maîtrisée.",
  },
  {
    icon: Layers,
    title: "Projets éditoriaux sériels",
    description: "Maintenir la continuité d'univers, de personnages et de style sur plusieurs épisodes.",
  },
  {
    icon: Workflow,
    title: "Équipes de production",
    description: "Structurer un pipeline reproductible avec validation qualité et review gates.",
  },
];

const Audience = () => {
  return (
    <section id="audience" className="py-20 sm:py-32 px-4">
      <div className="container mx-auto">
        <AnimatedSection variant="blurIn">
          <div className="text-center mb-14 sm:mb-20">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-4">
              Public
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              À qui s'adresse
              <br />
              <span className="text-primary">cette plateforme&nbsp;?</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Pensée pour les équipes qui veulent structurer leur production audiovisuelle.
            </p>
          </div>
        </AnimatedSection>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
          {audiences.map((item, idx) => (
            <AnimatedSection key={item.title} delay={0.05 * idx}>
              <motion.article
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className="h-full rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm p-6 sm:p-7 hover:border-primary/30 transition-colors"
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg mb-4">
                  <item.icon className="w-5 h-5 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </motion.article>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Audience;
