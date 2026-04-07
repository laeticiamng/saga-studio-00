import { FileText, Users, MapPin, Layers, Music, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface ExtractionResult {
  title?: string;
  synopsis?: string;
  genre?: string;
  tone?: string;
  characters: { name: string; role?: string }[];
  episodes: { title: string; number?: number }[];
  locations: string[];
  scenes: number;
  totalEntities: number;
  documentsProcessed: number;
  conflicts: number;
  missingFields: string[];
}

interface Props {
  result: ExtractionResult;
}

export default function ExtractionSummary({ result }: Props) {
  const stats = [
    { icon: FileText, label: "Documents analysés", value: result.documentsProcessed },
    { icon: Users, label: "Personnages détectés", value: result.characters.length },
    { icon: MapPin, label: "Lieux détectés", value: result.locations.length },
    { icon: Layers, label: "Scènes détectées", value: result.scenes },
  ];

  if (result.episodes.length > 0) {
    stats.push({ icon: Layers, label: "Épisodes détectés", value: result.episodes.length });
  }

  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Résumé de l'analyse
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {result.totalEntities} entité{result.totalEntities !== 1 ? "s" : ""} extraite{result.totalEntities !== 1 ? "s" : ""}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex items-center gap-2 rounded-lg bg-secondary/50 p-3">
                <Icon className="h-4 w-4 text-primary flex-shrink-0" />
                <div>
                  <p className="text-lg font-bold leading-none">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Characters preview */}
        {result.characters.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Personnages</p>
            <div className="flex flex-wrap gap-2">
              {result.characters.slice(0, 8).map((c) => (
                <Badge key={c.name} variant="outline" className="text-xs">
                  {c.name}
                  {c.role && <span className="text-muted-foreground ml-1">({c.role})</span>}
                </Badge>
              ))}
              {result.characters.length > 8 && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  +{result.characters.length - 8}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Conflicts */}
        {result.conflicts > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
            <span>{result.conflicts} conflit{result.conflicts !== 1 ? "s" : ""} détecté{result.conflicts !== 1 ? "s" : ""} entre documents — résolvable à l'étape suivante</span>
          </div>
        )}

        {/* Missing fields */}
        {result.missingFields.length > 0 && (
          <div className="rounded-lg bg-orange-500/10 p-3">
            <p className="text-sm font-medium text-orange-600 mb-1">Données manquantes :</p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {result.missingFields.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
