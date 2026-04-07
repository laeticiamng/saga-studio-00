import { Lightbulb } from "lucide-react";

interface Props {
  missing: string[];
}

export default function MissingInfoAlert({ missing }: Props) {
  if (missing.length === 0) return null;

  return (
    <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 flex gap-3">
      <Lightbulb className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium mb-1">Quelques informations manquantes</p>
        <p className="text-xs text-muted-foreground mb-2">
          Vos documents ne contiennent pas ces éléments — complétez-les manuellement si besoin :
        </p>
        <ul className="text-xs text-muted-foreground space-y-0.5">
          {missing.map((m) => (
            <li key={m}>• {m}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
