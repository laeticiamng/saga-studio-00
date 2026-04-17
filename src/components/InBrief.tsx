import AnimatedSection from "./AnimatedSection";

const InBrief = () => {
  return (
    <section id="in-brief" className="py-20 sm:py-28 px-4 border-t border-border/30">
      <div className="container mx-auto max-w-4xl">
        <AnimatedSection variant="blurIn">
          <div className="text-center">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-4">
              En bref
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Saga Studio en bref
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
              Saga Studio est une plateforme de production audiovisuelle assistée par IA. Elle centralise l'ingestion de contenus, la génération, la validation qualité, le montage et l'export pour accélérer la création de formats narratifs et vidéo.
            </p>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
};

export default InBrief;
