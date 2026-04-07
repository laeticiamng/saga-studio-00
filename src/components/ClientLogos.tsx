import { StaggerContainer, StaggerItem } from "./AnimatedSection";
import { Shield, FileText, Layers, Eye, Download, Palette } from "lucide-react";

const reassurances = [
  { icon: FileText, text: "Ingestion de documents" },
  { icon: Shield, text: "Qualité validée par IA" },
  { icon: Layers, text: "Timeline + Montage" },
  { icon: Eye, text: "Review Gates" },
  { icon: Palette, text: "Finishing cinématique" },
  { icon: Download, text: "Export multi-format" },
];

export default function ClientLogos() {
  return (
    <section className="py-6 sm:py-8 px-4 border-y border-border/20">
      <StaggerContainer staggerDelay={0.06} className="flex flex-wrap justify-center gap-4 md:gap-8 max-w-5xl mx-auto">
        {reassurances.map((r) => (
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
