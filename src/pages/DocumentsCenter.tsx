import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SeriesNotFound } from "@/components/SeriesNotFound";
import Footer from "@/components/Footer";
import { useSeries } from "@/hooks/useSeries";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  useSourceDocuments, useDocumentEntities, useUploadDocument, useUpdateMapping,
  useAutofillRuns, useBatchUpload, useUpdateDocumentRole, useUpdateSourcePriority,
  useCanonicalConflicts, useCanonicalFields, useApproveCanonicalField,
  useInferredCompletions, useReviewInferredCompletion, useResolveConflict,
  useReprocessDocument, useReprocessLegacyDocuments, useMarkLegacyDocuments,
} from "@/hooks/useDocuments";
import { useProjectKnowledgeGraph } from "@/hooks/useProjectKnowledge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  FileText, Upload, CheckCircle, XCircle, AlertTriangle, Eye, Loader2, FileUp,
  BookOpen, Users, Tv, MapPin, Music, Image, Shield, Zap, GitMerge, HelpCircle,
  Star, FileWarning, Layers, Film, Check, Brain, BarChart3, RefreshCw,
} from "lucide-react";
import { getSeriesProjectTitle } from "@/lib/series-helpers";

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  character: <Users className="h-4 w-4" />,
  episode: <Tv className="h-4 w-4" />,
  location: <MapPin className="h-4 w-4" />,
  music: <Music className="h-4 w-4" />,
  title: <BookOpen className="h-4 w-4" />,
  logline: <BookOpen className="h-4 w-4" />,
  synopsis: <FileText className="h-4 w-4" />,
  visual_reference: <Image className="h-4 w-4" />,
  scene: <Film className="h-4 w-4" />,
  continuity_rule: <Layers className="h-4 w-4" />,
};

const STATUS_LABELS: Record<string, string> = {
  uploaded: "Chargé",
  extracting: "Extraction…",
  parsing: "Lecture du fichier…",
  parsed: "Fichier lu",
  parsing_failed: "Lecture échouée",
  analyzing: "Analyse IA…",
  extracting_entities: "Extraction des entités…",
  extracted_entities: "Entités extraites",
  extraction_failed: "Extraction échouée",
  ready_for_review: "Prêt pour revue",
  reviewed: "Revu",
  applied: "Appliqué",
  // Legacy migration statuses
  legacy_result_detected: "Ancien parseur détecté",
  reprocess_pending: "Ré-analyse en attente",
  reprocessing: "Ré-analyse en cours…",
};

/** Human-readable parser failure messages keyed by extraction_mode */
const PARSER_FAILURE_LABELS: Record<string, string> = {
  docx_parse_failed: "Le fichier DOCX n'a pas pu être lu (format ZIP/XML invalide)",
  pdf_parse_failed: "Le PDF n'a pas pu être analysé par l'IA",
  text_parse_failed: "Le fichier texte est vide",
  doc_legacy_unsupported: "Format .doc ancien non supporté — convertissez en .docx",
  unsupported_file_type: "Type de fichier non supporté pour l'extraction de texte",
  download_failed: "Impossible de télécharger le fichier depuis le stockage",
  no_api_key: "Clé API manquante pour l'extraction PDF",
  // Legacy status from old edge function version — reprocessable with current parser
  pdf_vision_api_error: "Résultat ancien parseur — en attente de ré-analyse",
  pdf_vision_api: "Résultat ancien parseur — en attente de ré-analyse",
};

function getParserFailureMessage(extractionMode: string | null | undefined): string | null {
  if (!extractionMode) return null;
  // Check exact match first
  if (PARSER_FAILURE_LABELS[extractionMode]) return PARSER_FAILURE_LABELS[extractionMode];
  // Check prefix match (e.g. "docx_parse_failed: some detail")
  for (const [key, label] of Object.entries(PARSER_FAILURE_LABELS)) {
    if (extractionMode.startsWith(key)) return label;
  }
  if (extractionMode.includes("failed") || extractionMode.includes("error")) {
    return `Extraction échouée (${extractionMode})`;
  }
  return null;
}

const ROLE_LABELS: Record<string, string> = {
  script_master: "Script principal",
  episode_script: "Script épisode",
  film_script: "Script film",
  music_video_concept: "Concept clip",
  series_bible: "Bible de série",
  short_pitch: "Pitch court",
  producer_bible: "Bible producteur",
  one_pager: "One pager",
  continuity_doc: "Continuité",
  governance_doc: "Gouvernance",
  character_sheet: "Fiche personnage",
  world_pack_doc: "Pack univers",
  moodboard_doc: "Moodboard",
  wardrobe_doc: "Costumes",
  music_doc: "Document musical",
  lyric_doc: "Paroles",
  production_notes: "Notes de prod",
  legal_notes: "Notes légales",
  reference_images: "Références visuelles",
  unknown: "Non classé",
};

const PRIORITY_LABELS: Record<string, string> = {
  source_of_truth: "Source de vérité",
  preferred_source: "Source préférée",
  supporting_reference: "Référence",
  draft_only: "Brouillon",
  deprecated: "Obsolète",
};

const ENTITY_LABELS: Record<string, string> = {
  title: "Titre", logline: "Logline", synopsis: "Synopsis", genre: "Genre",
  tone: "Ton", target_audience: "Public cible", character: "Personnage",
  episode: "Épisode", location: "Lieu", prop: "Accessoire", costume: "Costume",
  wardrobe: "Garde-robe", music: "Musique", lyric: "Paroles", scene: "Scène",
  visual_reference: "Réf. visuelle", theme: "Thème", season_arc: "Arc de saison",
  dialogue_sample: "Dialogue", format: "Format", duration: "Durée",
  continuity_rule: "Règle continuité", legal_note: "Note légale",
  mood: "Ambiance", ambiance: "Ambiance", chronology: "Chronologie",
  relationship: "Relation", vfx_overlay: "VFX", cinematic_reference: "Réf. ciné",
  cliffhanger: "Cliffhanger", aspect_ratio: "Ratio",
};

const LEGACY_EXTRACTION_MODES = ["pdf_vision_api_error", "pdf_vision_api", "vision_api", "pdf_vision"];

/** Returns true for any document from a legacy parser — whether still in stale state or already marked */
function isLegacyDocument(doc: Record<string, unknown>): boolean {
  // Already marked by mark_legacy action
  const status = doc.status as string | null;
  if (status === "legacy_result_detected" || status === "reprocess_pending") return true;
  // Still in stale state — extraction_mode from old parser
  const mode = doc.extraction_mode as string | null;
  if (mode && LEGACY_EXTRACTION_MODES.some(m => mode === m || mode.startsWith(m))) return true;
  // Documents without parser_version in metadata were processed by old parser
  const meta = doc.metadata as Record<string, unknown> | null;
  const debug = meta?.extraction_debug as Record<string, unknown> | undefined;
  if (debug && !debug.parser_version) return true;
  return false;
}

/** Returns true only for legacy docs still in their stale unmigrated state (not yet marked) */
function isUnmarkedLegacyDocument(doc: Record<string, unknown>): boolean {
  const status = doc.status as string | null;
  if (status === "legacy_result_detected" || status === "reprocess_pending" || status === "reprocessing") return false;
  const mode = doc.extraction_mode as string | null;
  if (mode && LEGACY_EXTRACTION_MODES.some(m => mode === m || mode.startsWith(m))) return true;
  const meta = doc.metadata as Record<string, unknown> | null;
  const debug = meta?.extraction_debug as Record<string, unknown> | undefined;
  if (debug && !debug.parser_version) return true;
  return false;
}

const VALID_EXTENSIONS = [
  ".pdf",".docx",".doc",".txt",".md",".markdown",".rtf",
  ".jpg",".jpeg",".png",".webp",".gif",".bmp",".tiff",
  ".mp3",".wav",".m4a",".flac",
  ".mp4",".mov",".avi",".mkv",
];

export default function DocumentsCenter() {
  usePageTitle("Centre documentaire");
  const { id: seriesId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("projectId") || undefined;

  const { data: series, isLoading: seriesLoading } = useSeries(seriesId);
  const { data: documents, isLoading } = useSourceDocuments(seriesId, projectId);
  const uploadDocument = useUploadDocument();
  const batchUpload = useBatchUpload();
  const reprocessDocument = useReprocessDocument();
  const reprocessLegacy = useReprocessLegacyDocuments();
  const markLegacy = useMarkLegacyDocuments();
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [activeTab, setActiveTab] = useState("documents");
  const [selectedLegacyIds, setSelectedLegacyIds] = useState<Set<string>>(new Set());

  const selectedDoc = documents?.find(d => d.id === selectedDocId) || documents?.[0];
  const effectiveProjectId = projectId || (series as Record<string, unknown>)?.project_id as string | undefined;

  const legacyDocuments = documents?.filter(d => isLegacyDocument(d as Record<string, unknown>)) || [];
  const legacyCount = legacyDocuments.length;

  // Auto-mark legacy documents on load: transition stale state → legacy_result_detected
  const markLegacyCalledRef = useRef(false);
  useEffect(() => {
    if (markLegacyCalledRef.current || markLegacy.isPending) return;
    const unmarked = documents?.filter(d => isUnmarkedLegacyDocument(d as Record<string, unknown>)) || [];
    if (unmarked.length === 0) return;
    markLegacyCalledRef.current = true;
    markLegacy.mutate({
      projectId: effectiveProjectId,
      seriesId,
      documentIds: unmarked.map(d => d.id),
    });
  }, [documents, effectiveProjectId, seriesId, markLegacy]);

  const toggleLegacySelection = useCallback((docId: string) => {
    setSelectedLegacyIds(prev => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  }, []);

  const toggleAllLegacySelection = useCallback(() => {
    setSelectedLegacyIds(prev => {
      if (prev.size === legacyDocuments.length) return new Set();
      return new Set(legacyDocuments.map(d => d.id));
    });
  }, [legacyDocuments]);

  const handleReprocessDocument = useCallback(async (documentId: string) => {
    try {
      const result = await reprocessDocument.mutateAsync({ documentId });
      toast.success(`Document ré-analysé — ${result.entities_found || 0} entités extraites`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la ré-analyse");
    }
  }, [reprocessDocument]);

  const handleReprocessAllLegacy = useCallback(async () => {
    try {
      const result = await reprocessLegacy.mutateAsync({
        projectId: effectiveProjectId,
        seriesId,
      });
      setSelectedLegacyIds(new Set());
      toast.success(`${result.reprocessed} document(s) ré-analysé(s) avec le parseur actuel`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la migration");
    }
  }, [reprocessLegacy, effectiveProjectId, seriesId]);

  const handleReprocessSelectedLegacy = useCallback(async () => {
    if (selectedLegacyIds.size === 0) return;
    try {
      const result = await reprocessLegacy.mutateAsync({
        documentIds: Array.from(selectedLegacyIds),
      });
      setSelectedLegacyIds(new Set());
      toast.success(`${result.reprocessed} document(s) ré-analysé(s) avec le parseur actuel`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la migration");
    }
  }, [reprocessLegacy, selectedLegacyIds]);

  const handleFiles = useCallback(async (files: File[]) => {
    const validFiles = files.filter(f => {
      const ext = "." + f.name.split(".").pop()?.toLowerCase();
      return VALID_EXTENSIONS.includes(ext);
    });
    if (validFiles.length === 0) {
      toast.error("Aucun fichier supporté trouvé.");
      return;
    }

    if (validFiles.length === 1) {
      try {
        const result = await uploadDocument.mutateAsync({
          file: validFiles[0],
          seriesId,
          projectId,
        });
        toast.success(`${validFiles[0].name} importé — ${result.entities_found || 0} éléments détectés (rôle: ${ROLE_LABELS[result.document_role] || result.document_role})`);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Erreur d'import");
      }
    } else {
      try {
        setUploadProgress({ done: 0, total: validFiles.length });
        const result = await batchUpload.mutateAsync({
          files: validFiles,
          seriesId,
          projectId,
          onProgress: (done, total) => setUploadProgress({ done, total }),
        });
        setUploadProgress(null);
        toast.success(`${result.count} documents importés et analysés`);
      } catch (err: unknown) {
        setUploadProgress(null);
        toast.error(err instanceof Error ? err.message : "Erreur d'import batch");
      }
    }
  }, [seriesId, projectId, uploadDocument, batchUpload]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFiles(files);
  }, [handleFiles]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleFiles(files);
    e.target.value = "";
  };

  if (seriesId && !seriesLoading && !series) return <SeriesNotFound />;

  const isPending = uploadDocument.isPending || batchUpload.isPending;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto py-8 max-w-7xl px-4">
        <Breadcrumbs items={[
          { label: "Mes projets", href: "/dashboard" },
          ...(seriesId ? [{ label: getSeriesProjectTitle(series), href: `/series/${seriesId}` }] : []),
          { label: "Documents" },
        ]} />
        <h1 className="text-3xl font-bold flex items-center gap-2 mb-6">
          <FileText className="h-8 w-8 text-primary" /> Centre d'ingestion documentaire
        </h1>

        {/* Legacy document migration banner */}
        {legacyCount > 0 && (
          <div className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <RefreshCw className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-yellow-700">
                    {legacyCount} document{legacyCount > 1 ? "s" : ""} en attente de ré-analyse
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Ces documents ont été traités par l'ancien parseur. Les résultats précédents sont archivés — lancez la ré-analyse pour obtenir des résultats avec le parseur actuel.
                  </p>
                  {/* Selectable legacy document list */}
                  <div className="mt-2 space-y-1">
                    <button
                      className="text-xs text-yellow-700 underline hover:no-underline mb-1"
                      onClick={toggleAllLegacySelection}
                    >
                      {selectedLegacyIds.size === legacyDocuments.length ? "Tout désélectionner" : "Tout sélectionner"}
                    </button>
                    <div className="flex flex-wrap gap-1">
                      {legacyDocuments.map(d => (
                        <Badge
                          key={d.id}
                          variant="outline"
                          className={`text-xs cursor-pointer transition-colors ${
                            selectedLegacyIds.has(d.id)
                              ? "border-yellow-600 bg-yellow-500/20 text-yellow-800"
                              : "hover:border-yellow-500/50"
                          }`}
                          onClick={() => toggleLegacySelection(d.id)}
                        >
                          {selectedLegacyIds.has(d.id) ? <Check className="h-3 w-3 mr-0.5" /> : null}
                          {d.file_name as string}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <Button
                  variant="default"
                  size="sm"
                  disabled={reprocessLegacy.isPending}
                  onClick={handleReprocessAllLegacy}
                >
                  {reprocessLegacy.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1.5" />
                  )}
                  Ré-analyser {legacyCount > 1 ? "tous" : ""}
                </Button>
                {selectedLegacyIds.size > 0 && selectedLegacyIds.size < legacyDocuments.length && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-yellow-500/30 text-yellow-700 hover:bg-yellow-500/10"
                    disabled={reprocessLegacy.isPending}
                    onClick={handleReprocessSelectedLegacy}
                  >
                    {reprocessLegacy.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-1.5" />
                    )}
                    Ré-analyser sélectionnés ({selectedLegacyIds.size})
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

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
          {isPending ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="font-medium">Import et analyse IA en cours…</p>
              {uploadProgress && (
                <div className="w-48">
                  <Progress value={(uploadProgress.done / uploadProgress.total) * 100} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {uploadProgress.done}/{uploadProgress.total} fichiers traités
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <FileUp className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Glissez-déposez vos documents ici</p>
              <p className="text-sm text-muted-foreground">
                PDF, DOCX, TXT, Markdown, Images (JPG/PNG), Audio (MP3/WAV) · Plusieurs fichiers simultanés
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                L'IA classifie chaque document, extrait les entités, détecte les conflits et propose une vérité canonique.
              </p>
            </div>
          )}
          <input
            id="doc-input"
            type="file"
            accept={VALID_EXTENSIONS.join(",")}
            className="hidden"
            onChange={handleFileSelect}
            multiple
          />
        </div>

        {/* Main tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="documents" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Documents ({documents?.length || 0})
            </TabsTrigger>
             {effectiveProjectId && (
              <>
                <TabsTrigger value="knowledge" className="gap-1.5">
                  <Brain className="h-3.5 w-3.5" /> Cerveau projet
                </TabsTrigger>
                <TabsTrigger value="conflicts" className="gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> Conflits
                </TabsTrigger>
                <TabsTrigger value="canonical" className="gap-1.5">
                  <GitMerge className="h-3.5 w-3.5" /> Vérité canonique
                </TabsTrigger>
                <TabsTrigger value="missing" className="gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5" /> Infos manquantes
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="documents">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Documents ({documents?.length || 0})</h2>
                {isLoading && <p className="text-muted-foreground">Chargement…</p>}
                {documents?.map(doc => (
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    isSelected={selectedDoc?.id === doc.id}
                    onClick={() => setSelectedDocId(doc.id)}
                    onReprocess={handleReprocessDocument}
                    isReprocessing={reprocessDocument.isPending}
                  />
                ))}
                {documents?.length === 0 && !isLoading && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun document. Importez vos fichiers source pour commencer.
                  </p>
                )}
              </div>

              <div className="lg:col-span-2">
                {selectedDoc ? (
                  <DocumentDetail documentId={selectedDoc.id} seriesId={seriesId} doc={selectedDoc} onReprocess={handleReprocessDocument} isReprocessing={reprocessDocument.isPending} />
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
          </TabsContent>

          {effectiveProjectId && (
            <>
              <TabsContent value="knowledge">
                <KnowledgePanel projectId={effectiveProjectId} />
              </TabsContent>
              <TabsContent value="conflicts">
                <ConflictsPanel projectId={effectiveProjectId} />
              </TabsContent>
              <TabsContent value="canonical">
                <CanonicalPanel projectId={effectiveProjectId} />
              </TabsContent>
              <TabsContent value="missing">
                <MissingPanel projectId={effectiveProjectId} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}

// ——— Document Card ———
function DocumentCard({
  doc,
  isSelected,
  onClick,
  onReprocess,
  isReprocessing,
}: {
  doc: Record<string, unknown>;
  isSelected: boolean;
  onClick: () => void;
  onReprocess?: (documentId: string) => void;
  isReprocessing?: boolean;
}) {
  const updateRole = useUpdateDocumentRole();
  const updatePriority = useUpdateSourcePriority();
  const isLegacy = isLegacyDocument(doc);

  return (
    <Card
      className={`cursor-pointer transition-colors ${isSelected ? "border-primary" : "hover:border-primary/50"}`}
      onClick={onClick}
    >
      <CardContent className="py-3 space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{doc.file_name as string}</p>
            <p className="text-xs text-muted-foreground">
              v{doc.version as number} · {new Date(doc.created_at as string).toLocaleDateString("fr-FR")}
              {doc.file_type && <span className="ml-1 uppercase">· {doc.file_type as string}</span>}
            </p>
          </div>
          <Badge variant={
            isLegacy ? "outline" :
            (doc.status as string)?.includes("failed") ? "destructive" :
            (doc.status as string) === "ready_for_review" ? "default" :
            (doc.status as string) === "reprocessing" ? "secondary" : "secondary"
          } className={`text-xs ${isLegacy ? "border-yellow-500/50 text-yellow-700" : ""}`}>
            {isLegacy && !(doc.status as string)?.includes("reprocess")
              ? "Ancien parseur"
              : STATUS_LABELS[doc.status as string] || doc.status as string}
          </Badge>
        </div>
        {/* Show specific parser failure message — legacy docs get info style, not error */}
        {isLegacy ? (
          <p className="text-xs text-yellow-700 flex items-center gap-1">
            <RefreshCw className="h-3 w-3 shrink-0" />
            Ancien parseur — en attente de ré-analyse
          </p>
        ) : getParserFailureMessage(doc.extraction_mode as string) ? (
          <p className="text-xs text-destructive flex items-center gap-1">
            <XCircle className="h-3 w-3 shrink-0" />
            {getParserFailureMessage(doc.extraction_mode as string)}
          </p>
        ) : null}
        {/* Reprocess button for legacy documents */}
        {isLegacy && onReprocess && (
          <div onClick={e => e.stopPropagation()}>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs w-full border-yellow-500/30 text-yellow-700 hover:bg-yellow-500/10"
              disabled={isReprocessing}
              onClick={() => onReprocess(doc.id as string)}
            >
              {isReprocessing ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Ré-analyser avec le parseur actuel
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-xs">
            {ROLE_LABELS[doc.document_role as string] || doc.document_role as string}
          </Badge>
          {Number(doc.role_confidence) > 0 && Number(doc.role_confidence) < 1 && (
            <Badge variant="secondary" className="text-xs">
              {(Number(doc.role_confidence) * 100).toFixed(0)}%
            </Badge>
          )}
        </div>

        {/* Role selector (click stops propagation) */}
        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
          <Select
            value={doc.document_role as string}
            onValueChange={(v) => updateRole.mutate({ id: doc.id as string, document_role: v })}
          >
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={doc.source_priority as string}
            onValueChange={(v) => updatePriority.mutate({ id: doc.id as string, source_priority: v })}
          >
            <SelectTrigger className="h-7 text-xs w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

// ——— Document Detail ———
function DocumentDetail({
  documentId,
  seriesId,
  doc,
  onReprocess,
  isReprocessing,
}: {
  documentId: string;
  seriesId?: string;
  doc: Record<string, unknown>;
  onReprocess?: (documentId: string) => void;
  isReprocessing?: boolean;
}) {
  const { data: entities, isLoading } = useDocumentEntities(documentId);
  const { data: autofillRuns } = useAutofillRuns(documentId);
  const updateMapping = useUpdateMapping();
  const isLegacy = isLegacyDocument(doc);

  type DocumentEntity = NonNullable<typeof entities>[number];
  const entitiesByType: Record<string, DocumentEntity[]> = {};
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
      {/* Document summary card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" /> {doc.file_name as string}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-3">
            <Badge variant="outline">{ROLE_LABELS[doc.document_role as string] || "Non classé"}</Badge>
            <Badge variant="secondary">{PRIORITY_LABELS[doc.source_priority as string] || "Référence"}</Badge>
            {Number(doc.role_confidence) > 0 && (
              <Badge variant="secondary">Confiance: {(Number(doc.role_confidence) * 100).toFixed(0)}%</Badge>
            )}
            {doc.extraction_mode && !isLegacy && (
              <Badge variant="outline" className="text-xs">
                Extraction: {doc.extraction_mode as string}
              </Badge>
            )}
            {isLegacy && (
              <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-700">
                En attente de ré-analyse
              </Badge>
            )}
          </div>
          {/* Legacy document — show reprocess prompt, NOT old error */}
          {isLegacy && (
            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 text-sm mb-3 flex items-start gap-2">
              <RefreshCw className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-700">
                  Résultat ancien parseur — en attente de ré-analyse
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ce document a été traité par une version précédente du parseur. Le résultat affiché n'est plus fiable.
                  Lancez la ré-analyse pour obtenir un résultat avec le parseur actuel.
                </p>
                {onReprocess && (
                  <Button
                    size="sm"
                    variant="default"
                    className="mt-2 h-7 text-xs"
                    disabled={isReprocessing}
                    onClick={() => onReprocess(documentId)}
                  >
                    {isReprocessing ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1" />
                    )}
                    Ré-analyser avec le parseur actuel
                  </Button>
                )}
              </div>
            </div>
          )}
          {/* Parser status warning — granular failure messages (non-legacy only) */}
          {!isLegacy && (
            (doc.extraction_mode as string)?.includes("failed") ||
            (doc.extraction_mode as string)?.includes("error") ||
            (doc.extraction_mode as string)?.includes("unsupported") ||
            (doc.status as string)?.includes("failed")
          ) && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm mb-3 flex items-start gap-2">
              <XCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">
                  {(doc.extraction_mode as string) === "doc_legacy_unsupported"
                    ? "Format .doc non supporté"
                    : (doc.extraction_mode as string)?.startsWith("docx_parse_failed")
                    ? "Lecture du fichier DOCX échouée"
                    : (doc.extraction_mode as string)?.startsWith("pdf_parse_failed")
                    ? "Lecture du PDF échouée"
                    : (doc.extraction_mode as string) === "download_failed"
                    ? "Téléchargement du fichier échoué"
                    : "Extraction du texte échouée"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {getParserFailureMessage(doc.extraction_mode as string) ||
                    `Le contenu n'a pas pu être lu (${doc.extraction_mode as string || "erreur inconnue"}).`}
                </p>
                {(doc.extraction_mode as string) === "doc_legacy_unsupported" && (
                  <p className="text-xs text-muted-foreground mt-1 font-medium">
                    Ouvrez le fichier dans Word ou LibreOffice et enregistrez-le au format .docx avant de le ré-importer.
                  </p>
                )}
              </div>
            </div>
          )}
          {/* Extraction debug panel */}
          {(doc.metadata as Record<string, unknown>)?.extraction_debug && (() => {
            const debug = (doc.metadata as Record<string, unknown>).extraction_debug as Record<string, unknown>;
            const textPreview = debug?.text_preview as string | undefined;
            const textLen = debug?.extracted_text_length as number | undefined;
            const parserDebug = debug?.parser_debug as Record<string, unknown> | undefined;
            return (
              <div className="rounded-lg bg-secondary/30 p-3 text-xs mb-3 space-y-2 font-mono">
                <p className="font-medium text-foreground text-sm mb-1">
                  {debug.parser_version ? "Diagnostic d'extraction" : "Diagnostic d'extraction (ancien parseur)"}
                </p>
                {/* Key metrics */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <p><span className="text-foreground font-medium">parser:</span> {String(debug.parser_chosen ?? "—")}</p>
                  <p><span className="text-foreground font-medium">status:</span> {String(debug.parser_status ?? "—")}</p>
                  <p><span className="text-foreground font-medium">version:</span> {String(debug.parser_version ?? "legacy")}</p>
                  <p><span className="text-foreground font-medium">file_type:</span> {String(debug.file_type_detected ?? "—")}</p>
                  <p><span className="text-foreground font-medium">text_length:</span> {String(textLen ?? 0)} chars</p>
                  <p><span className="text-foreground font-medium">fallback:</span> {String(debug.fallback_attempted ?? false)}</p>
                  <p><span className="text-foreground font-medium">chunks:</span> {String(debug.chunk_count ?? "—")}</p>
                </div>
                {debug.error_message && (
                  <p className="text-destructive"><span className="font-medium">error:</span> {String(debug.error_message)}</p>
                )}
                {/* Parser-specific debug */}
                {parserDebug && (
                  <div className="border-t border-border/50 pt-1 mt-1">
                    <p className="font-medium text-foreground mb-0.5">Parser debug:</p>
                    {Object.entries(parserDebug).map(([k, v]) => (
                      <p key={k} className="text-muted-foreground">
                        <span className="text-foreground">{k}:</span>{" "}
                        {typeof v === "string" && v.length > 150 ? v.slice(0, 150) + "…" : String(v ?? "null")}
                      </p>
                    ))}
                  </div>
                )}
                {/* Text preview — first 500 chars */}
                {textPreview && textPreview !== "(empty)" && (
                  <div className="border-t border-border/50 pt-1 mt-1">
                    <p className="font-medium text-foreground mb-0.5">Aperçu du texte extrait ({textLen?.toLocaleString()} chars) :</p>
                    <p className="text-muted-foreground whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                      {textPreview.slice(0, 500)}{(textPreview.length > 500) ? "…" : ""}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Previous run history */}
      {(() => {
        const meta = doc.metadata as Record<string, unknown> | null;
        const previousRuns = (meta?.run_history || meta?.previous_runs || []) as Array<Record<string, unknown>>;
        if (previousRuns.length === 0) return null;
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <Eye className="h-4 w-4" /> Historique des analyses ({previousRuns.length} exécution{previousRuns.length > 1 ? "s" : ""} précédente{previousRuns.length > 1 ? "s" : ""})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {previousRuns.map((run, i) => (
                  <div key={i} className="rounded-md bg-secondary/30 px-3 py-2 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={run.parser_success ? "secondary" : "destructive"} className="text-[10px]">
                        {run.parser_success ? "Succès" : "Échec"}
                      </Badge>
                      <span className="text-muted-foreground font-mono">
                        {String(run.parser_chosen || run.old_extraction_mode || "—")}
                      </span>
                      {run.parser_version && (
                        <span className="text-muted-foreground">v{String(run.parser_version)}</span>
                      )}
                    </div>
                    <span className="text-muted-foreground">
                      {run.archived_at ? new Date(String(run.archived_at)).toLocaleDateString("fr-FR") : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Autofill summary — hidden for legacy docs (stale data, not current truth) */}
      {latestRun && !isLegacy && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {latestRun.status === "failed" ? (
                <XCircle className="h-5 w-5 text-destructive" />
              ) : latestRun.total_fields === 0 ? (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
              Résumé de l'extraction
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latestRun.status === "failed" ? (
              <p className="text-sm text-destructive">L'analyse de ce document a échoué. Vérifiez que le fichier est lisible.</p>
            ) : latestRun.total_fields === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune entité extraite. Le document est peut-être trop court, protégé ou dans un format non supporté.</p>
            ) : (
              <>
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
                <Progress value={(latestRun.auto_filled! / Math.max(1, latestRun.total_fields!)) * 100} className="h-2" />
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Legacy doc: pending reprocess notice instead of stale entities */}
      {isLegacy && (
        <Card>
          <CardContent className="py-8 text-center">
            <RefreshCw className="h-8 w-8 mx-auto mb-3 text-yellow-600 opacity-70" />
            <p className="font-medium text-yellow-700 mb-1">Résultat ancien parseur archivé</p>
            <p className="text-sm text-muted-foreground">
              Les données précédentes ne sont plus affichées comme résultat actif.
              Lancez la ré-analyse pour obtenir un résultat fiable avec le parseur actuel.
            </p>
            {onReprocess && (
              <Button
                size="sm"
                variant="default"
                className="mt-3"
                disabled={isReprocessing}
                onClick={() => onReprocess(documentId)}
              >
                {isReprocessing ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                Ré-analyser avec le parseur actuel
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Entities by type — only shown for non-legacy docs with actual current results */}
      {!isLegacy && Object.keys(entitiesByType).length > 0 && (
        <Tabs defaultValue={Object.keys(entitiesByType)[0]}>
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
                {items.map((entity) => (
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

                          <div className="text-sm text-muted-foreground">
                            {typeof entity.entity_value === "object" && entity.entity_value !== null ? (
                              <div className="space-y-0.5">
                                {Object.entries(entity.entity_value as Record<string, unknown>).slice(0, 4).map(([k, v]) => (
                                  <p key={k}><span className="font-medium">{k}:</span> {String(v).slice(0, 100)}</p>
                                ))}
                              </div>
                            ) : (
                              <p>{String(entity.entity_value).slice(0, 200)}</p>
                            )}
                          </div>

                          {entity.source_passage && (
                            <p className="text-xs text-muted-foreground mt-1 italic border-l-2 border-primary/30 pl-2">
                              "{entity.source_passage.slice(0, 150)}{entity.source_passage.length > 150 ? "…" : ""}"
                            </p>
                          )}

                          {entity.mappings?.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {entity.mappings.map((m: { id: string; target_table: string; target_field: string; status: string }) => (
                                <div key={m.id} className="flex items-center gap-2 text-xs">
                                  <span className="text-muted-foreground">→ {m.target_table}.{m.target_field}</span>
                                  <Badge variant="outline" className="text-xs">{m.status}</Badge>
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
      )}

      {entities?.length === 0 && !isLegacy && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucune entité extraite. L'analyse IA est peut-être en cours ou le document est vide.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ——— Knowledge Graph Panel ———
function KnowledgePanel({ projectId }: { projectId: string }) {
  const { data: graph, isLoading } = useProjectKnowledgeGraph(projectId);

  if (isLoading) return <Card><CardContent className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></CardContent></Card>;
  if (!graph) return null;

  const entityTypeLabels: Record<string, string> = {
    character: "Personnages", episode: "Épisodes", scene: "Scènes",
    location: "Lieux", music: "Musique", prop: "Accessoires",
    mood: "Ambiances", continuity_rule: "Continuité", visual_reference: "Réf. visuelles",
    title: "Titres", logline: "Loglines", synopsis: "Synopsis",
    wardrobe: "Costumes", relationship: "Relations", lyric: "Paroles",
    season_arc: "Arcs saison", act_structure: "Structure actes",
    beat_map: "Beat map", performance_cue: "Cues perf.",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Brain className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Cerveau projet — Graphe de connaissances</h2>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-primary">{graph.documents_count}</p>
            <p className="text-xs text-muted-foreground">Documents</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-primary">{graph.total_entities}</p>
            <p className="text-xs text-muted-foreground">Entités extraites</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-primary">{graph.canonical_approved}/{graph.canonical_fields}</p>
            <p className="text-xs text-muted-foreground">Canoniques approuvées</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold">{graph.conflicts_unresolved}</p>
            <p className="text-xs text-muted-foreground">Conflits ouverts</p>
          </CardContent>
        </Card>
      </div>

      {/* Entity breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Entités par type
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(graph.entities_by_type)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([type, count]) => (
                <div key={type} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div className="flex items-center gap-2">
                    {ENTITY_ICONS[type] || <Layers className="h-3.5 w-3.5" />}
                    <span className="text-sm">{entityTypeLabels[type] || type}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">{count as number}</Badge>
                </div>
              ))}
          </div>
          {Object.keys(graph.entities_by_type).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune entité extraite. Importez des documents pour alimenter le cerveau projet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Document roles breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Documents par rôle
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {graph.documents_by_role.map(([role, count]) => (
              <Badge key={role} variant="outline" className="text-sm py-1 px-3">
                {ROLE_LABELS[role] || role}: {count}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Health indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" /> Santé de la mémoire projet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Couverture canonique</span>
            <div className="flex items-center gap-2">
              <Progress value={graph.canonical_fields > 0 ? (graph.canonical_approved / graph.canonical_fields) * 100 : 0} className="w-24 h-2" />
              <span className="text-xs text-muted-foreground">
                {graph.canonical_fields > 0 ? Math.round((graph.canonical_approved / graph.canonical_fields) * 100) : 0}%
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Conflits résolus</span>
            <div className="flex items-center gap-2">
              <Progress value={graph.conflicts_total > 0 ? ((graph.conflicts_total - graph.conflicts_unresolved) / graph.conflicts_total) * 100 : 100} className="w-24 h-2" />
              <span className="text-xs text-muted-foreground">
                {graph.conflicts_total > 0 ? `${graph.conflicts_total - graph.conflicts_unresolved}/${graph.conflicts_total}` : "—"}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Gaps comblés</span>
            <div className="flex items-center gap-2">
              <Progress value={graph.inferred_total > 0 ? ((graph.inferred_total - graph.inferred_pending) / graph.inferred_total) * 100 : 100} className="w-24 h-2" />
              <span className="text-xs text-muted-foreground">
                {graph.inferred_total > 0 ? `${graph.inferred_total - graph.inferred_pending}/${graph.inferred_total}` : "—"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ——— Conflicts Panel ———
function ConflictsPanel({ projectId }: { projectId: string }) {
  const { data: conflicts, isLoading } = useCanonicalConflicts(projectId);
  const resolveConflict = useResolveConflict();

  const unresolved = conflicts?.filter(c => c.resolution === "unresolved") || [];
  const resolved = conflicts?.filter(c => c.resolution !== "unresolved") || [];

  if (isLoading) return <Card><CardContent className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></CardContent></Card>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-5 w-5 text-yellow-500" />
        <h2 className="text-lg font-semibold">
          {unresolved.length > 0 ? `${unresolved.length} conflit(s) non résolu(s)` : "Aucun conflit détecté"}
        </h2>
      </div>

      {unresolved.map(conflict => (
        <Card key={conflict.id} className="border-yellow-500/30">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <FileWarning className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">{ENTITY_LABELS[conflict.entity_type] || conflict.entity_type}: {conflict.field_key}</span>
                  <Badge variant={conflict.severity === "high" ? "destructive" : "secondary"} className="text-xs">
                    {conflict.severity === "high" ? "Critique" : "Moyen"}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div className="rounded-lg border border-border p-3 text-sm">
                    <p className="text-xs text-muted-foreground mb-1">Document A</p>
                    <p className="text-foreground">{JSON.stringify(conflict.value_a, null, 1)?.slice(0, 150)}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-sm">
                    <p className="text-xs text-muted-foreground mb-1">Document B</p>
                    <p className="text-foreground">{JSON.stringify(conflict.value_b, null, 1)?.slice(0, 150)}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => resolveConflict.mutate({
                      id: conflict.id,
                      canonical_value: conflict.value_a,
                      resolution: "resolved_a",
                    })}
                  >
                    <Check className="h-3 w-3" /> Garder A
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => resolveConflict.mutate({
                      id: conflict.id,
                      canonical_value: conflict.value_b,
                      resolution: "resolved_b",
                    })}
                  >
                    <Check className="h-3 w-3" /> Garder B
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {resolved.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">{resolved.length} conflit(s) résolu(s)</h3>
          {resolved.map(c => (
            <div key={c.id} className="flex items-center gap-2 text-sm text-muted-foreground py-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>{ENTITY_LABELS[c.entity_type] || c.entity_type}: {c.field_key}</span>
              <Badge variant="outline" className="text-xs">{c.resolution}</Badge>
            </div>
          ))}
        </div>
      )}

      {conflicts?.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Aucun conflit détecté entre vos documents. La vérité canonique est cohérente.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ——— Canonical Panel ———
function CanonicalPanel({ projectId }: { projectId: string }) {
  const { data: fields, isLoading } = useCanonicalFields(projectId);
  const approveField = useApproveCanonicalField();

  if (isLoading) return <Card><CardContent className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></CardContent></Card>;

  const grouped: Record<string, NonNullable<typeof fields>> = {};
  fields?.forEach(f => {
    if (!grouped[f.entity_type]) grouped[f.entity_type] = [];
    grouped[f.entity_type].push(f);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <GitMerge className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Vérité canonique du projet ({fields?.length || 0} champs)</h2>
      </div>

      {Object.entries(grouped).map(([type, items]) => (
        <Card key={type}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {ENTITY_ICONS[type] || <Layers className="h-4 w-4" />}
              {ENTITY_LABELS[type] || type} ({items.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map(field => (
              <div key={field.id} className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{field.entity_name || field.field_key}</span>
                    <Badge variant={field.approved ? "default" : "outline"} className="text-xs">
                      {field.approved ? "Approuvé" : "En attente"}
                    </Badge>
                    {field.inferred && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Zap className="h-3 w-3" /> Inféré
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {(field.confidence * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {typeof field.canonical_value === "object"
                      ? JSON.stringify(field.canonical_value, null, 1)?.slice(0, 200)
                      : String(field.canonical_value).slice(0, 200)}
                  </p>
                  {field.source_passage && (
                    <p className="text-xs text-muted-foreground mt-1 italic border-l-2 border-primary/30 pl-2">
                      "{field.source_passage.slice(0, 120)}…"
                    </p>
                  )}
                </div>
                {!field.approved && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0"
                    onClick={() => approveField.mutate({ id: field.id })}
                  >
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {fields?.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <GitMerge className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Aucun champ canonique encore. Importez des documents pour construire la vérité projet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ——— Missing Info Panel ———
function MissingPanel({ projectId }: { projectId: string }) {
  const { data: completions, isLoading } = useInferredCompletions(projectId);
  const reviewCompletion = useReviewInferredCompletion();

  const proposed = completions?.filter(c => c.status === "proposed") || [];
  const reviewed = completions?.filter(c => c.status !== "proposed") || [];

  if (isLoading) return <Card><CardContent className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></CardContent></Card>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <HelpCircle className="h-5 w-5 text-yellow-500" />
        <h2 className="text-lg font-semibold">
          {proposed.length > 0 ? `${proposed.length} information(s) manquante(s)` : "Projet complet"}
        </h2>
      </div>

      {proposed.map(comp => (
        <Card key={comp.id} className="border-yellow-500/20">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{ENTITY_LABELS[comp.field_key] || comp.field_key}</span>
                  <Badge variant="outline" className="text-xs">{comp.entity_type}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {comp.source_context}
                </p>
                {comp.confidence > 0 && (
                  <p className="text-sm mb-2">
                    Suggestion IA: {JSON.stringify(comp.inferred_value, null, 1)?.slice(0, 200)}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => reviewCompletion.mutate({ id: comp.id, status: "accepted" })}
                  >
                    <CheckCircle className="h-3 w-3 text-green-500" /> Accepter
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-muted-foreground"
                    onClick={() => reviewCompletion.mutate({ id: comp.id, status: "rejected" })}
                  >
                    <XCircle className="h-3 w-3" /> Ignorer
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {reviewed.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Traité(s)</h3>
          {reviewed.map(c => (
            <div key={c.id} className="flex items-center gap-2 text-sm text-muted-foreground py-1">
              {c.status === "accepted" ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
              <span>{ENTITY_LABELS[c.field_key] || c.field_key}</span>
            </div>
          ))}
        </div>
      )}

      {completions?.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Star className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Toutes les informations nécessaires sont disponibles. Aucun gap détecté.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
