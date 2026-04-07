import { FileText, PenLine } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export type CreationMode = "scratch" | "corpus";

interface Props {
  value: CreationMode;
  onChange: (mode: CreationMode) => void;
}

const MODES = [
  {
    value: "scratch" as const,
    icon: PenLine,
    label: "Partir de zéro",
    desc: "Saisissez manuellement votre brief, l'IA développera votre idée",
  },
  {
    value: "corpus" as const,
    icon: FileText,
    label: "Importer des documents",
    desc: "Uploadez vos fichiers existants — scripts, bibles, moodboards — et la plateforme pré-remplit votre projet",
  },
];

export default function CreationModeSelector({ value, onChange }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {MODES.map((m) => {
        const Icon = m.icon;
        const selected = value === m.value;
        return (
          <Card
            key={m.value}
            className={`cursor-pointer transition-all border-2 ${
              selected
                ? "border-primary bg-primary/5 shadow-md"
                : "border-border/50 hover:border-primary/30"
            }`}
            onClick={() => onChange(m.value)}
          >
            <CardContent className="flex items-start gap-4 p-6">
              <div className={`p-3 rounded-xl ${selected ? "bg-primary/10" : "bg-secondary"}`}>
                <Icon className={`h-6 w-6 ${selected ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div>
                <h3 className="font-semibold mb-1">{m.label}</h3>
                <p className="text-sm text-muted-foreground">{m.desc}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
