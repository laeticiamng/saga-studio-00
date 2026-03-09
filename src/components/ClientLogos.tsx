import { motion } from "framer-motion";
import AnimatedSection, { StaggerContainer, StaggerItem } from "./AnimatedSection";
import { Shield, Zap, Download } from "lucide-react";

const reassurances = [
  { icon: Shield, text: "Données sécurisées en Europe" },
  { icon: Zap, text: "Vidéo prête en 5 à 15 minutes" },
  { icon: Download, text: "Export MP4 — YouTube, TikTok, Instagram" },
];

export default function ClientLogos() {
  return (
    <section className="py-8 md:py-10 px-4 border-y border-border/30">
      <StaggerContainer staggerDelay={0.1} className="flex flex-wrap justify-center gap-5 md:gap-10 max-w-3xl mx-auto">
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
