import { Card } from "@/components/ui/card";
import { Film, Users, Music, Sparkles, Wand2, CheckCircle } from "lucide-react";

const features = [
  {
    icon: Film,
    title: "Vidéos longue durée",
    description: "Générez des clips de 4-5 minutes d'une seule traite, sans coupures ni interruptions.",
    gradient: "from-orange-500 to-red-500"
  },
  {
    icon: Sparkles,
    title: "Cohérence visuelle",
    description: "Un style artistique uniforme et des transitions fluides du début à la fin de votre vidéo.",
    gradient: "from-yellow-500 to-orange-500"
  },
  {
    icon: Users,
    title: "Personnalisation avancée",
    description: "Intégrez votre visage, choisissez le nombre de personnages et définissez leur apparence.",
    gradient: "from-amber-500 to-yellow-500"
  },
  {
    icon: Music,
    title: "Synchronisation musicale",
    description: "Uploadez votre bande son et l'IA synchronise parfaitement l'action avec la musique.",
    gradient: "from-orange-600 to-amber-500"
  },
  {
    icon: Wand2,
    title: "Styles illimités",
    description: "Du réalisme photo au dessin animé, créez dans le style artistique de votre choix.",
    gradient: "from-red-500 to-orange-600"
  },
  {
    icon: CheckCircle,
    title: "Qualité premium",
    description: "Export en 4K avec la meilleure qualité disponible sur le marché grâce à SORA 2.",
    gradient: "from-yellow-600 to-orange-500"
  }
];

const Features = () => {
  return (
    <section className="py-24 px-4 relative">
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Tout ce dont vous avez besoin pour créer
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Une plateforme complète avec les technologies les plus avancées du marché
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card 
              key={index}
              className="p-6 bg-gradient-card backdrop-blur-sm border-border/50 hover:shadow-elevated transition-all duration-300 group"
            >
              <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
