import example1 from "@/assets/example-1.jpg";
import example2 from "@/assets/example-2.jpg";
import example3 from "@/assets/example-3.jpg";
import { Play } from "lucide-react";

const examples = [
  {
    image: example1,
    title: "Clip musical futuriste",
    duration: "4:32",
    style: "Sci-Fi / Cyberpunk"
  },
  {
    image: example2,
    title: "Animation cohérente",
    duration: "5:15",
    style: "Animation 3D"
  },
  {
    image: example3,
    title: "Court-métrage dramatique",
    duration: "4:48",
    style: "Cinématique réaliste"
  }
];

const Gallery = () => {
  return (
    <section className="py-24 px-4 bg-gradient-to-b from-background to-secondary/20">
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Exemples de créations
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Découvrez ce que vous pourrez créer avec notre plateforme
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {examples.map((example, index) => (
            <div 
              key={index}
              className="group relative rounded-xl overflow-hidden cursor-pointer"
            >
              <div className="aspect-square relative">
                <img 
                  src={example.image} 
                  alt={example.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-glow">
                    <Play className="w-8 h-8 text-primary-foreground fill-current ml-1" />
                  </div>
                </div>
              </div>
              
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                <h3 className="text-xl font-semibold mb-1">{example.title}</h3>
                <div className="flex items-center gap-3 text-sm text-white/80">
                  <span>{example.duration}</span>
                  <span>•</span>
                  <span>{example.style}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Gallery;
