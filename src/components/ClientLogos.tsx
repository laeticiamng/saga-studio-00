import { StaggerContainer, StaggerItem } from "./AnimatedSection";
import { Shield, Zap, Download, Layers, Eye } from "lucide-react";

const reassurances = [
  { icon: Shield, text: "Contrôle qualité IA intégré" },
  { icon: Layers, text: "Timeline + Rough Cut + Fine Cut" },
  { icon: Eye, text: "Review Gates à chaque étape" },
  { icon: Download, text: "Export multi-format avec QC" },
  { icon: Zap, text: "Projet prêt en ~10 min" },
];

export default function ClientLogos() {
  return (
    <section className="py-8 md:py-10 px-4 border-y border-border/30">
      <StaggerContainer staggerDelay={0.08} className="flex flex-wrap justify-center gap-4 md:gap-8 max-w-4xl mx-auto">
        {reassurances.map((r) => (
          <StaggerItem key={r.text} variant="fadeUp">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <r.icon className="h-4 w-4 text-primary shrink-0" />
              <span>{r.text}</span>
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </section>
  );
}
