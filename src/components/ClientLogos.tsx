import { StaggerContainer, StaggerItem } from "./AnimatedSection";
import { Shield, FileText, Layers, Eye, Download, Palette } from "lucide-react";

const capabilities = [
  { icon: FileText, text: "Import de scripts & documents" },
  { icon: Shield, text: "Validation qualité automatique" },
  { icon: Layers, text: "Timeline & montage" },
  { icon: Eye, text: "Validation à chaque étape" },
  { icon: Palette, text: "Look cinématique unifié" },
  { icon: Download, text: "Export 1080p / 4K / 9:16" },
];

export default function ClientLogos() {
  return (
    <section
      aria-label="Capacités clés"
      className="py-6 sm:py-8 px-4 border-y border-border/20"
    >
      <StaggerContainer staggerDelay={0.06} className="flex flex-wrap justify-center gap-4 md:gap-8 max-w-5xl mx-auto">
        {capabilities.map((r) => (
          <StaggerItem key={r.text} variant="fadeUp">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <r.icon className="h-4 w-4 text-primary/70 shrink-0" />
              <span>{r.text}</span>
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </section>
  );
}
