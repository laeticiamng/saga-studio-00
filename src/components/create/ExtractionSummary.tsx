import { FileText, Users, MapPin, Layers, Music, AlertTriangle, CheckCircle2, XCircle, Info, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export interface DocumentDiagnostic {
  id: string;
  fileName: string;
  role: string;
  roleConfidence: number;
  fileType: string;
  extractionMode?: string;
  parserVersion?: string;
  status: string;
  entitiesCount: number;
  textLength?: number;
  textPreview?: string;
  parserError?: string;
  parserDebug?: Record<string, unknown> | null;
}

export interface ExtractionResult {
  title?: string;
  synopsis?: string;
  genre?: string;
  tone?: string;
  characters: { name: string; role?: string; age?: string }[];
  episodes: { title: string; number?: number }[];
  locations: string[];
  scenes: number;
  totalEntities: number;
  documentsProcessed: number;
  conflicts: number;
  missingFields: string[];
  diagnostics?: DocumentDiagnostic[];
}

interface Props {
  result: ExtractionResult;
  onReprocessDocument?: (documentId: string) => void;
  onReprocessAllLegacy?: () => void;
  isReprocessing?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  script_master: "Script principal",
  episode_script: "Script épisode",
  film_script: "Script film",
  series_bible: "Bible de série",
  short_pitch: "Pitch court",
  producer_bible: "Bible producteur",
  one_pager: "One pager",
  governance_doc: "Gouvernance",
  character_sheet: "Fiche personnage",
  continuity_doc: "Continuité",
  reference_images: "Réf. visuelles",
  unknown: "Non classé",
};

export default function ExtractionSummary({ result, onReprocessDocument, onReprocessAllLegacy, isReprocessing }: Props) {
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const hasLegacyOnly = result.diagnostics?.filter(d => d.fileType !== "image").every(d => isLegacyDoc(d)) ?? false;
  const hasRealExtraction = result.totalEntities > 0 && !hasLegacyOnly;
  const isParserFailure = (d: DocumentDiagnostic) =>
    d.fileType !== "image" && (
      d.entitiesCount === 0 ||
      d.extractionMode?.includes("failed") ||
      d.extractionMode?.includes("error") ||
      d.status?.includes("failed")
    );
  const isLegacyDoc = (d: DocumentDiagnostic) =>
    d.parserVersion === "legacy" ||
    (!d.parserVersion && (
      d.extractionMode === "pdf_vision_api_error" ||
      d.extractionMode === "pdf_vision_api" ||
      d.extractionMode?.startsWith("vision_api") ||
      d.extractionMode?.startsWith("pdf_vision")
    ));
  const hasParserFailures = result.diagnostics?.some(isParserFailure);
  const allFailed = result.diagnostics?.filter(d => d.fileType !== "image").every(isParserFailure);
  const legacyDocs = result.diagnostics?.filter(d => d.fileType !== "image" && isLegacyDoc(d)) || [];
  const hasLegacyDocs = legacyDocs.length > 0;

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
    <Card className={`border-${allFailed ? "destructive" : hasParserFailures ? "yellow-500" : "primary"}/20 bg-${allFailed ? "destructive" : "primary"}/[0.02]`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {allFailed ? (
              <XCircle className="h-5 w-5 text-destructive" />
            ) : hasRealExtraction ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            )}
            {allFailed
              ? "Échec de l'analyse"
              : hasRealExtraction
              ? "Résumé de l'analyse"
              : "Analyse partielle"}
          </CardTitle>
          <Badge variant={hasRealExtraction ? "secondary" : "destructive"} className="text-xs">
            {result.totalEntities} entité{result.totalEntities !== 1 ? "s" : ""} extraite{result.totalEntities !== 1 ? "s" : ""}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Legacy documents banner — actionable reprocessing */}
        {hasLegacyDocs && (
          <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 text-sm">
            <p className="font-medium text-yellow-700 mb-1 flex items-center gap-1.5">
              <RefreshCw className="h-4 w-4" />
              {legacyDocs.length} document{legacyDocs.length > 1 ? "s" : ""} analysé{legacyDocs.length > 1 ? "s" : ""} avec l'ancien parseur
            </p>
            <p className="text-muted-foreground text-xs mb-2">
              Ces documents ont été traités par une version précédente du parseur.
              Le résultat affiché n'est plus fiable. Relancez l'analyse pour obtenir un résultat avec le parseur actuel.
            </p>
            {legacyDocs.map(d => (
              <div key={d.id} className="flex items-center justify-between text-xs mt-1">
                <span className="text-muted-foreground truncate mr-2">{d.fileName}</span>
                {onReprocessDocument && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs px-2 shrink-0"
                    disabled={isReprocessing}
                    onClick={() => onReprocessDocument(d.id)}
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${isReprocessing ? "animate-spin" : ""}`} />
                    Ré-analyser
                  </Button>
                )}
              </div>
            ))}
            {legacyDocs.length > 1 && onReprocessAllLegacy && (
              <Button
                size="sm"
                variant="default"
                className="mt-2 h-7 text-xs w-full"
                disabled={isReprocessing}
                onClick={onReprocessAllLegacy}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isReprocessing ? "animate-spin" : ""}`} />
                Ré-analyser tous les documents hérités
              </Button>
            )}
          </div>
        )}

        {/* Parser failure warning */}
        {allFailed && !hasLegacyDocs && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm">
            <p className="font-medium text-destructive mb-1">L'extraction a échoué sur tous les documents</p>
            <p className="text-muted-foreground text-xs">
              Les fichiers n'ont pas pu être lus correctement. Vérifiez qu'il s'agit bien de documents textuels (PDF, DOCX, TXT) et non de fichiers corrompus ou protégés.
            </p>
            {result.diagnostics?.filter(d => d.fileType !== "image" && isParserFailure(d) && !isLegacyDoc(d)).map(d => (
              <p key={d.id} className="text-xs text-destructive/80 mt-1">
                {d.fileName}: {
                  d.extractionMode === "doc_legacy_unsupported" ? "Format .doc ancien — convertissez en .docx" :
                  d.extractionMode?.startsWith("docx_parse_failed") ? "DOCX illisible (structure ZIP/XML invalide)" :
                  d.extractionMode?.startsWith("pdf_parse_failed") ? "PDF illisible par l'API Vision" :
                  d.extractionMode === "download_failed" ? "Téléchargement échoué" :
                  d.extractionMode === "unsupported_file_type" ? "Type de fichier non supporté" :
                  d.extractionMode || "erreur inconnue"
                }
              </p>
            ))}
          </div>
        )}

        {/* Partial failure warning */}
        {hasParserFailures && !allFailed && (
          <div className="rounded-lg bg-yellow-500/10 p-3 text-sm">
            <p className="font-medium text-yellow-600 mb-1">Certains documents n'ont pas pu être lus</p>
            {result.diagnostics?.filter(d => d.fileType !== "image" && isParserFailure(d)).map(d => (
              <p key={d.id} className="text-xs text-muted-foreground">
                {d.fileName}: {
                  d.extractionMode === "doc_legacy_unsupported" ? "Format .doc ancien — convertissez en .docx" :
                  d.extractionMode?.startsWith("docx_parse_failed") ? "DOCX illisible" :
                  d.extractionMode || "erreur"
                }
              </p>
            ))}
          </div>
        )}

        {/* Stats grid */}
        {hasRealExtraction && (
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
        )}

        {/* Characters preview */}
        {result.characters.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Personnages</p>
            <div className="flex flex-wrap gap-2">
              {result.characters.slice(0, 8).map((c) => (
                <Badge key={c.name} variant="outline" className="text-xs">
                  {c.name}
                  {c.role && <span className="text-muted-foreground ml-1">({c.role})</span>}
                  {c.age && <span className="text-muted-foreground ml-1">{c.age}</span>}
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

        {/* Locations preview */}
        {result.locations.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Lieux</p>
            <div className="flex flex-wrap gap-2">
              {result.locations.slice(0, 6).map((l) => (
                <Badge key={l} variant="outline" className="text-xs">
                  <MapPin className="h-3 w-3 mr-1" />{l}
                </Badge>
              ))}
              {result.locations.length > 6 && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  +{result.locations.length - 6}
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

        {/* Missing fields — only shown if extraction actually succeeded */}
        {hasRealExtraction && result.missingFields.length > 0 && (
          <div className="rounded-lg bg-orange-500/10 p-3">
            <p className="text-sm font-medium text-orange-600 mb-1">Données non trouvées dans le corpus :</p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {result.missingFields.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground mt-2 italic">
              Ces champs pourront être renseignés manuellement à l'étape suivante.
            </p>
          </div>
        )}

        {/* Diagnostics toggle */}
        {result.diagnostics && result.diagnostics.length > 0 && (
          <div>
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Info className="h-3.5 w-3.5" />
              Détail par document
              {showDiagnostics ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {showDiagnostics && (
              <div className="mt-2 space-y-1.5">
                {result.diagnostics.map((d) => (
                  <div key={d.id} className="rounded-md bg-secondary/30 px-3 py-2 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="truncate font-medium">{d.fileName}</span>
                        <span className="text-muted-foreground uppercase text-[10px]">{d.fileType}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className="text-[10px]">
                          {ROLE_LABELS[d.role] || d.role}
                        </Badge>
                        {d.parserVersion && (
                          <Badge variant="outline" className="text-[10px] font-mono">
                            v{d.parserVersion}
                          </Badge>
                        )}
                        {d.entitiesCount > 0 && !isLegacyDoc(d) ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {d.entitiesCount} entités
                          </Badge>
                        ) : d.fileType === "image" ? (
                          <Badge variant="secondary" className="text-[10px]">Image</Badge>
                        ) : isLegacyDoc(d) ? (
                          <Badge variant="outline" className="text-[10px] border-yellow-500/50 text-yellow-700">
                            Ancien parseur
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">
                            {d.extractionMode?.includes("failed") || d.extractionMode?.includes("error") || d.extractionMode?.includes("unsupported")
                              ? "Lecture échouée"
                              : "0 entités"}
                          </Badge>
                        )}
                        {d.textLength !== undefined && d.textLength > 0 && (
                          <span className="text-muted-foreground text-[10px]">
                            {d.textLength.toLocaleString()} chars
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Show specific parser status */}
                    {d.extractionMode && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground pl-5">
                        <span className="font-mono">
                          {d.extractionMode.length > 60 ? d.extractionMode.slice(0, 60) + "…" : d.extractionMode}
                        </span>
                      </div>
                    )}
                    {/* Show text preview for debugging */}
                    {d.textPreview && d.textLength && d.textLength > 0 && (
                      <div className="text-[10px] text-muted-foreground pl-5 italic truncate">
                        {(d.textPreview as string).slice(0, 120)}…
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
