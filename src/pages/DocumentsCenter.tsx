import { useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import Footer from "@/components/Footer";
import { useSeries } from "@/hooks/useSeries";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useSourceDocuments, useDocumentEntities, useUploadDocument, useUpdateMapping, useAutofillRuns } from "@/hooks/useDocuments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { FileText, Upload, CheckCircle, XCircle, AlertTriangle, Eye, Loader2, FileUp, BookOpen, Users, Tv, MapPin, Music } from "lucide-react";
import { getSeriesProjectTitle } from "@/lib/series-helpers";

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  character: <Users className="h-4 w-4" />,
  episode: <Tv className="h-4 w-4" />,
  location: <MapPin className="h-4 w-4" />,
  music: <Music className="h-4 w-4" />,
  title: <BookOpen className="h-4 w-4" />,
  logline: <BookOpen className="h-4 w-4" />,
  synopsis: <FileText className="h-4 w-4" />,
};

const STATUS_LABELS: Record<string, string> = {
  uploaded: "Chargé",
  extracting: "Extraction...",
  analyzing: "Analyse IA...",
  ready_for_review: "Prêt pour revue",
  reviewed: "Revu",
  applied: "Appliqué",
};

const ENTITY_LABELS: Record<string, string> = {
  title: "Titre",
  logline: "Logline",
  synopsis: "Synopsis",
  genre: "Genre",
  tone: "Ton",
  target_audience: "Public cible",
  character: "Personnage",
  episode: "Épisode",
  location: "Lieu",
  prop: "Accessoire",
  costume: "Costume",
  music: "Musique",
  scene: "Scène",
  visual_reference: "Référence visuelle",
  theme: "Thème",
  season_arc: "Arc de saison",
  dialogue_sample: "Dialogue",
  format: "Format",
  duration: "Durée",
};

export default function DocumentsCenter() {
  usePageTitle("Centre documentaire");
  const { id: seriesId } = useParams<{ id: string }>();
  const { data: series } = useSeries(seriesId);
  const { data: documents, isLoading } = useSourceDocuments(seriesId);
  const uploadDocument = useUploadDocument();
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const selectedDoc = documents?.find(d => d.id === selectedDocId) || documents?.[0];

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    
    const file = files[0];
    const validTypes = [".pdf", ".docx", ".doc", ".txt", ".md", ".markdown", ".rtf"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!validTypes.includes(ext)) {
      toast.error("Format non supporté. Utilisez PDF, DOCX, TXT ou Markdown.");
      return;
    }

    try {
      const result = await uploadDocument.mutateAsync({ file, seriesId });
      toast.success(`Document importé : ${result.entities_found} éléments détectés`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur d'import");
    }
  }, [seriesId, uploadDocument]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadDocument.mutateAsync({ file, seriesId });
      toast.success(`Document importé : ${result.entities_found} éléments détectés`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur d'import");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto py-8 max-w-6xl">
        <Breadcrumbs items={[
          { label: "Mes projets", href: "/dashboard" },
          { label: getSeriesProjectTitle(series), href: `/series/${seriesId}` },
          { label: "Documents" },
        ]} />
        <h1 className="text-3xl font-bold flex items-center gap-2 mb-6">
          <FileText className="h-8 w-8" /> Centre documentaire
        </h1>

        {/* Upload zone */}
        <div
          className={`mb-6 rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
            isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById("doc-input")?.click()}
        >
          {uploadDocument.isPending ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="font-medium">Import et analyse en cours...</p>
              <p className="text-sm text-muted-foreground">L'IA extrait les informations de votre document</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <FileUp className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Glissez-déposez votre document ici</p>
              <p className="text-sm text-muted-foreground">PDF, DOCX, TXT, Markdown · Max 50 Mo</p>
              <p className="text-xs text-muted-foreground mt-1">
                L'IA extraira automatiquement titre, synopsis, personnages, épisodes, décors, musique...
              </p>
            </div>
          )}
          <input
            id="doc-input"
            type="file"
            accept=".pdf,.docx,.doc,.txt,.md,.markdown,.rtf"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {/* Documents list + detail */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: document list */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Documents ({documents?.length || 0})</h2>
            {isLoading && <p className="text-muted-foreground">Chargement...</p>}
            {documents?.map(doc => (
              <Card
                key={doc.id}
                className={`cursor-pointer transition-colors ${selectedDoc?.id === doc.id ? "border-primary" : "hover:border-primary/50"}`}
                onClick={() => setSelectedDocId(doc.id)}
              >
                <CardContent className="py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{doc.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        v{doc.version} · {new Date(doc.created_at).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <Badge variant={doc.status === "ready_for_review" ? "default" : "secondary"} className="text-xs">
                      {STATUS_LABELS[doc.status] || doc.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
            {documents?.length === 0 && !isLoading && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun document. Importez un document source pour commencer.
              </p>
            )}
          </div>

          {/* Right: detail */}
          <div className="lg:col-span-2">
            {selectedDoc ? (
              <DocumentDetail documentId={selectedDoc.id} seriesId={seriesId} />
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Sélectionnez un document ou importez-en un nouveau</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function DocumentDetail({ documentId, seriesId }: { documentId: string; seriesId?: string }) {
  const { data: entities, isLoading } = useDocumentEntities(documentId);
  const { data: autofillRuns } = useAutofillRuns(documentId);
  const updateMapping = useUpdateMapping();

  // Group entities by type
  const entitiesByType: Record<string, any[]> = {};
  entities?.forEach(e => {
    if (!entitiesByType[e.entity_type]) entitiesByType[e.entity_type] = [];
    entitiesByType[e.entity_type].push(e);
  });

  const latestRun = autofillRuns?.[0];

  const handleMappingAction = async (mappingId: string, status: "accepted" | "rejected") => {
    try {
      await updateMapping.mutateAsync({ id: mappingId, status });
      toast.success(status === "accepted" ? "Champ accepté" : "Champ rejeté");
    } catch {
      toast.error("Erreur");
    }
  };

  if (isLoading) return <Card><CardContent className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></CardContent></Card>;

  return (
    <div className="space-y-4">
      {/* Autofill summary */}
      {latestRun && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-5 w-5" /> Résumé de l'extraction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{latestRun.auto_filled}</p>
                <p className="text-xs text-muted-foreground">Pré-remplis</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{latestRun.needs_review}</p>
                <p className="text-xs text-muted-foreground">À valider</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{latestRun.total_fields}</p>
                <p className="text-xs text-muted-foreground">Total détecté</p>
              </div>
            </div>
            <Progress value={(latestRun.auto_filled / Math.max(1, latestRun.total_fields)) * 100} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Entities by type */}
      <Tabs defaultValue={Object.keys(entitiesByType)[0] || "empty"}>
        <TabsList className="flex-wrap">
          {Object.entries(entitiesByType).map(([type, items]) => (
            <TabsTrigger key={type} value={type} className="gap-1">
              {ENTITY_ICONS[type] || <FileText className="h-3 w-3" />}
              {ENTITY_LABELS[type] || type} ({items.length})
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(entitiesByType).map(([type, items]) => (
          <TabsContent key={type} value={type}>
            <div className="space-y-3">
              {items.map((entity: any) => (
                <Card key={entity.id}>
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{entity.entity_key}</span>
                          <Badge variant={
                            entity.extraction_confidence >= 0.8 ? "default" :
                            entity.extraction_confidence >= 0.5 ? "secondary" : "destructive"
                          } className="text-xs">
                            {(entity.extraction_confidence * 100).toFixed(0)}%
                          </Badge>
                          {entity.ambiguity_flag && (
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          )}
                        </div>

                        {/* Value preview */}
                        <div className="text-sm text-muted-foreground">
                          {typeof entity.entity_value === "object" ? (
                            <div className="space-y-0.5">
                              {Object.entries(entity.entity_value as Record<string, unknown>).slice(0, 4).map(([k, v]) => (
                                <p key={k}><span className="font-medium">{k}:</span> {String(v).slice(0, 100)}</p>
                              ))}
                            </div>
                          ) : (
                            <p>{String(entity.entity_value).slice(0, 200)}</p>
                          )}
                        </div>

                        {/* Source passage */}
                        {entity.source_passage && (
                          <p className="text-xs text-muted-foreground mt-1 italic border-l-2 border-primary/30 pl-2">
                            "{entity.source_passage.slice(0, 150)}{entity.source_passage.length > 150 ? "..." : ""}"
                          </p>
                        )}

                        {/* Mappings */}
                        {entity.mappings?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {entity.mappings.map((m: any) => (
                              <div key={m.id} className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground">→ {m.target_table}.{m.target_field}</span>
                                <Badge variant="outline" className="text-xs">
                                  {m.status}
                                </Badge>
                                {m.status === "proposed" && (
                                  <div className="flex gap-1">
                                    <Button size="sm" variant="ghost" className="h-5 px-1" onClick={() => handleMappingAction(m.id, "accepted")}>
                                      <CheckCircle className="h-3 w-3 text-green-500" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-5 px-1" onClick={() => handleMappingAction(m.id, "rejected")}>
                                      <XCircle className="h-3 w-3 text-red-500" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {entities?.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucune entité extraite. L'analyse IA est peut-être en cours ou le document est vide.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
