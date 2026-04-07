import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useCreateSeries } from "@/hooks/useSeries";
import { logger } from "@/lib/logger";
import {
  Film, Music, Tv, Upload, ArrowRight, ArrowLeft, Check,
  Loader2, Sparkles, Video, ImagePlus, X, Wand2, Coins,
  Clock, RectangleHorizontal, Square, Smartphone,
} from "lucide-react";

import CreationModeSelector, { type CreationMode } from "@/components/create/CreationModeSelector";
import CorpusUploader, { type CorpusFile } from "@/components/create/CorpusUploader";
import ExtractionSummary, { type ExtractionResult } from "@/components/create/ExtractionSummary";
import ExtractedField, { type ExtractedValue } from "@/components/create/ExtractedField";
import MissingInfoAlert from "@/components/create/MissingInfoAlert";

// Style preview images
import styleCinematic from "@/assets/styles/cinematic.jpg";
import styleAnime from "@/assets/styles/anime.jpg";
import styleRealistic from "@/assets/styles/realistic.jpg";
import styleNoir from "@/assets/styles/noir.jpg";
import styleVintage from "@/assets/styles/vintage.jpg";
import styleNeon from "@/assets/styles/neon.jpg";
import styleDocumentary from "@/assets/styles/documentary.jpg";
import styleFantasy from "@/assets/styles/fantasy.jpg";
import styleWatercolor from "@/assets/styles/watercolor.jpg";
import style3dRender from "@/assets/styles/3d_render.jpg";

type ProjectType = "series" | "film" | "music_video" | "hybrid_video";

const PROJECT_TYPES: { value: ProjectType; label: string; icon: React.ElementType; desc: string }[] = [
  { value: "series", label: "Série", icon: Tv, desc: "Épisodes multi-saisons avec continuité narrative" },
  { value: "film", label: "Film", icon: Film, desc: "Long-métrage ou court-métrage narratif" },
  { value: "music_video", label: "Clip Musical", icon: Music, desc: "Vidéo synchronisée au rythme musical" },
  { value: "hybrid_video", label: "Vidéo Hybride", icon: Video, desc: "Vidéo existante + améliorations IA" },
];

const QUALITY_TIERS = [
  { value: "premium", label: "Premium", desc: "Vidéo native, rendu serveur", creditsPerMin: 10 },
  { value: "standard", label: "Standard", desc: "Recommandé — bon équilibre qualité/coût", creditsPerMin: 5 },
  { value: "economy", label: "Économique", desc: "Plus rapide, assemblage navigateur", creditsPerMin: 2 },
];

const STYLES: { value: string; label: string; img: string }[] = [
  { value: "cinematic", label: "Cinématique", img: styleCinematic },
  { value: "anime", label: "Anime", img: styleAnime },
  { value: "realistic", label: "Réaliste", img: styleRealistic },
  { value: "noir", label: "Noir", img: styleNoir },
  { value: "vintage", label: "Vintage", img: styleVintage },
  { value: "neon", label: "Néon", img: styleNeon },
  { value: "documentary", label: "Documentaire", img: styleDocumentary },
  { value: "fantasy", label: "Fantaisie", img: styleFantasy },
  { value: "watercolor", label: "Aquarelle", img: styleWatercolor },
  { value: "3d_render", label: "Rendu 3D", img: style3dRender },
];

const ASPECT_RATIOS = [
  { value: "16:9", label: "16:9", desc: "Paysage", icon: RectangleHorizontal },
  { value: "9:16", label: "9:16", desc: "Portrait", icon: Smartphone },
  { value: "1:1", label: "1:1", desc: "Carré", icon: Square },
];

export default function CreateProject() {
  usePageTitle("Nouveau projet");
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const createSeries = useCreateSeries();

  // Wizard state
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);

  // Step 0: Type + Mode
  const [projectType, setProjectType] = useState<ProjectType>("film");
  const [creationMode, setCreationMode] = useState<CreationMode>("scratch");

  // Step 1 (corpus): Corpus upload
  const [corpusFiles, setCorpusFiles] = useState<CorpusFile[]>([]);
  const [corpusUploading, setCorpusUploading] = useState(false);
  const [corpusProgress, setCorpusProgress] = useState<{ done: number; total: number } | null>(null);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [extractedFields, setExtractedFields] = useState<ExtractedValue[]>([]);
  const [corpusProcessed, setCorpusProcessed] = useState(false);

  // Step 2 (brief) — shared between scratch and corpus
  const [title, setTitle] = useState("");
  const [synopsis, setSynopsis] = useState("");

  // Step 3: Params
  const [durationMin, setDurationMin] = useState("5");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  // Step 4: Style
  const [style, setStyle] = useState("cinematic");
  const [qualityTier, setQualityTier] = useState("standard");

  // Step 5: Identity
  const [refPhotos, setRefPhotos] = useState<File[]>([]);

  // Track accepted/rejected extracted fields
  const [acceptedFields, setAcceptedFields] = useState<Record<string, string>>({});

  // Warn before leaving mid-wizard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (step > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [step]);

  // Dynamic steps based on creation mode
  const wizardSteps = useMemo(() => {
    if (creationMode === "corpus") {
      return [
        { label: "Type & Mode", short: "1" },
        { label: "Corpus", short: "2" },
        { label: "Brief", short: "3" },
        { label: "Paramètres", short: "4" },
        { label: "Style & Qualité", short: "5" },
        { label: "Identité", short: "6" },
        { label: "Confirmer", short: "7" },
      ];
    }
    return [
      { label: "Type & Mode", short: "1" },
      { label: "Brief", short: "2" },
      { label: "Paramètres", short: "3" },
      { label: "Style & Qualité", short: "4" },
      { label: "Identité", short: "5" },
      { label: "Confirmer", short: "6" },
    ];
  }, [creationMode]);

  // Map logical step to content
  const getStepContent = useCallback((s: number): string => {
    if (creationMode === "corpus") {
      return ["type", "corpus", "brief", "params", "style", "identity", "confirm"][s] || "type";
    }
    return ["type", "brief", "params", "style", "identity", "confirm"][s] || "type";
  }, [creationMode]);

  const currentContent = getStepContent(step);

  // Corpus upload + extraction
  const handleAddCorpusFiles = useCallback((files: File[]) => {
    const newFiles: CorpusFile[] = files.map((f) => ({
      file: f,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      status: "pending" as const,
    }));
    setCorpusFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleRemoveCorpusFile = useCallback((id: string) => {
    setCorpusFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleProcessCorpus = async () => {
    if (!user || corpusFiles.length === 0) return;
    setCorpusUploading(true);
    setCorpusProgress({ done: 0, total: corpusFiles.length });

    try {
      const documentIds: string[] = [];

      for (let i = 0; i < corpusFiles.length; i++) {
        const cf = corpusFiles[i];
        setCorpusFiles((prev) =>
          prev.map((f) => (f.id === cf.id ? { ...f, status: "uploading" } : f))
        );

        // Upload to storage
        const storagePath = `${user.id}/${Date.now()}-${cf.file.name}`;
        const { error: uploadErr } = await supabase.storage
          .from("source-documents")
          .upload(storagePath, cf.file);
        if (uploadErr) {
          setCorpusFiles((prev) =>
            prev.map((f) =>
              f.id === cf.id ? { ...f, status: "error", errorMessage: uploadErr.message } : f
            )
          );
          continue;
        }

        setCorpusFiles((prev) =>
          prev.map((f) => (f.id === cf.id ? { ...f, status: "processing" } : f))
        );

        // Register document (without project_id — pre-project)
        const { data, error } = await supabase.functions.invoke("import-document", {
          body: {
            file_name: cf.file.name,
            file_type: cf.file.type,
            file_size_bytes: cf.file.size,
            storage_path: storagePath,
          },
        });

        if (error) {
          setCorpusFiles((prev) =>
            prev.map((f) =>
              f.id === cf.id ? { ...f, status: "error", errorMessage: "Erreur d'analyse" } : f
            )
          );
        } else {
          setCorpusFiles((prev) =>
            prev.map((f) =>
              f.id === cf.id
                ? {
                    ...f,
                    status: "done",
                    role: data?.document_role,
                    roleConfidence: data?.role_confidence,
                    entitiesFound: data?.entities_found,
                  }
                : f
            )
          );
          if (data?.document_id) documentIds.push(data.document_id);
        }

        setCorpusProgress({ done: i + 1, total: corpusFiles.length });
      }

      // Now run wizard_extract to get prefill data
      if (documentIds.length > 0) {
        const { data: extractData, error: extractErr } = await supabase.functions.invoke(
          "import-document",
          {
            body: {
              action: "wizard_extract",
              document_ids: documentIds,
              project_type: projectType,
            },
          }
        );

        if (!extractErr && extractData) {
          setExtractionResult({
            title: extractData.prefill?.title || undefined,
            synopsis: extractData.prefill?.synopsis || undefined,
            genre: extractData.prefill?.genre || undefined,
            tone: extractData.prefill?.tone || undefined,
            characters: extractData.prefill?.characters || [],
            episodes: extractData.prefill?.episodes || [],
            locations: extractData.prefill?.locations || [],
            scenes: extractData.prefill?.scenes || 0,
            totalEntities: extractData.prefill?.totalEntities || 0,
            documentsProcessed: extractData.documentsProcessed || 0,
            conflicts: extractData.prefill?.conflicts || 0,
            missingFields: extractData.prefill?.missingFields || [],
          });
          setExtractedFields(extractData.extractedFields || []);

          // Auto-prefill title and synopsis if high confidence
          const titleField = extractData.extractedFields?.find(
            (f: ExtractedValue) => f.key === "title" && f.confidence >= 0.7
          );
          const synopsisField = extractData.extractedFields?.find(
            (f: ExtractedValue) => f.key === "synopsis" && f.confidence >= 0.7
          );
          if (titleField) setTitle(titleField.value);
          if (synopsisField) setSynopsis(synopsisField.value);
        }
      }

      setCorpusProcessed(true);
    } catch (err) {
      logger.error("CorpusUpload", err);
      toast({ title: "Erreur lors du traitement du corpus", variant: "destructive" });
    } finally {
      setCorpusUploading(false);
      setCorpusProgress(null);
    }
  };

  const addRefPhotos = (files: FileList | null) => {
    if (!files) return;
    setRefPhotos((prev) => [...prev, ...Array.from(files).slice(0, 10 - prev.length)]);
  };
  const removeRef = (idx: number) => setRefPhotos((prev) => prev.filter((_, i) => i !== idx));

  // Cost estimation
  const estimatedCredits = useMemo(() => {
    const tier = QUALITY_TIERS.find((q) => q.value === qualityTier);
    const mins = parseInt(durationMin) || 5;
    return (tier?.creditsPerMin || 5) * mins;
  }, [qualityTier, durationMin]);

  const canNext = (s: number): boolean => {
    const content = getStepContent(s);
    if (content === "type") return !!projectType;
    if (content === "corpus") return corpusFiles.length > 0 && corpusProcessed;
    if (content === "brief") return title.trim().length > 0;
    return true;
  };

  const handleAcceptField = (key: string, value: string) => {
    setAcceptedFields((prev) => ({ ...prev, [key]: value }));
    if (key === "title") setTitle(value);
    if (key === "synopsis") setSynopsis(value);
  };

  const handleRejectField = (key: string) => {
    setAcceptedFields((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (key === "title" && title) setTitle("");
    if (key === "synopsis" && synopsis) setSynopsis("");
  };

  const handleEnrichSynopsis = async () => {
    if (!synopsis.trim() || enriching) return;
    setEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke("enhance-synopsis", {
        body: { synopsis, type: projectType, style },
      });
      if (error) throw error;
      if (data?.enhanced) setSynopsis(data.enhanced);
    } catch (err) {
      logger.error("EnrichSynopsis", err);
      toast({ title: "Erreur lors de l'enrichissement", variant: "destructive" });
    } finally {
      setEnriching(false);
    }
  };

  const handleCreate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const durationSec = parseInt(durationMin) * 60;

      let audioUrl: string | undefined;
      if (audioFile && projectType === "music_video") {
        const path = `${user.id}/${Date.now()}-${audioFile.name}`;
        const { error: upErr } = await supabase.storage.from("audio-uploads").upload(path, audioFile);
        if (upErr) throw upErr;
        audioUrl = path;
      }

      const refUrls: string[] = [];
      for (const file of refPhotos) {
        const path = `${user.id}/refs/${Date.now()}-${file.name}`;
        const { error: refErr } = await supabase.storage.from("shot-outputs").upload(path, file);
        if (!refErr) refUrls.push(path);
      }

      if (projectType === "series") {
        const result = await createSeries.mutateAsync({
          title: title.trim(),
          logline: synopsis.trim() || undefined,
          style_preset: style,
          episode_duration_min: parseInt(durationMin),
          total_seasons: 1,
          episodes_per_season: extractionResult?.episodes?.length || 10,
        });
        toast({ title: "Série créée !" });
        navigate(`/series/${result.series.id}`);
        return;
      }

      const dbType = projectType === "hybrid_video" ? "film" : projectType === "music_video" ? "music_video" : "film";
      const { data, error } = await supabase.functions.invoke("create-project", {
        body: {
          type: dbType,
          title: title.trim(),
          synopsis: synopsis.trim() || undefined,
          style_preset: style,
          duration_sec: durationSec,
          aspect_ratio: aspectRatio,
          quality_tier: qualityTier,
          audio_url: audioUrl,
          ref_photo_urls: refUrls,
          mode: projectType === "hybrid_video" ? "hybrid" : "story",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Projet créé !" });
      navigate(`/project/${data.project.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de la création";
      toast({ title: message, variant: "destructive" });
      logger.error("CreateProject", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container max-w-3xl py-10 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Nouveau projet</h1>
          <p className="text-muted-foreground">Créez un projet audiovisuel complet propulsé par l'IA</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-10 relative">
          <div className="absolute top-5 left-10 right-10 h-px bg-border hidden sm:block" />
          {wizardSteps.map((s, i) => (
            <div key={s.label} className="flex flex-col items-center gap-1.5 relative z-10 flex-1">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all ${
                  i < step
                    ? "bg-primary text-primary-foreground"
                    : i === step
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={`text-xs font-medium hidden sm:block ${
                  i <= step ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* ──── STEP: Type & Mode ──── */}
        {currentContent === "type" && (
          <div className="space-y-8">
            {/* Project type */}
            <div>
              <Label className="text-base font-semibold mb-4 block">Type de projet</Label>
              <div className="grid gap-4 sm:grid-cols-2">
                {PROJECT_TYPES.map((pt) => {
                  const Icon = pt.icon;
                  const selected = projectType === pt.value;
                  return (
                    <Card
                      key={pt.value}
                      className={`cursor-pointer transition-all border-2 ${
                        selected
                          ? "border-primary bg-primary/5 shadow-md"
                          : "border-border/50 hover:border-primary/30"
                      }`}
                      onClick={() => setProjectType(pt.value)}
                    >
                      <CardContent className="flex items-start gap-4 p-6">
                        <div className={`p-3 rounded-xl ${selected ? "bg-primary/10" : "bg-secondary"}`}>
                          <Icon
                            className={`h-6 w-6 ${selected ? "text-primary" : "text-muted-foreground"}`}
                          />
                        </div>
                        <div>
                          <h3 className="font-semibold mb-1">{pt.label}</h3>
                          <p className="text-sm text-muted-foreground">{pt.desc}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Creation mode */}
            <div>
              <Label className="text-base font-semibold mb-4 block">Comment souhaitez-vous commencer ?</Label>
              <CreationModeSelector value={creationMode} onChange={setCreationMode} />
            </div>
          </div>
        )}

        {/* ──── STEP: Corpus Upload ──── */}
        {currentContent === "corpus" && (
          <div className="space-y-6">
            <CorpusUploader
              files={corpusFiles}
              onAddFiles={handleAddCorpusFiles}
              onRemoveFile={handleRemoveCorpusFile}
              uploading={corpusUploading}
              progress={corpusProgress}
            />

            {corpusFiles.length > 0 && !corpusProcessed && !corpusUploading && (
              <Button onClick={handleProcessCorpus} className="w-full" size="lg">
                <Sparkles className="h-4 w-4 mr-2" />
                Analyser le corpus ({corpusFiles.length} fichier{corpusFiles.length > 1 ? "s" : ""})
              </Button>
            )}

            {corpusProcessed && extractionResult && (
              <ExtractionSummary result={extractionResult} />
            )}
          </div>
        )}

        {/* ──── STEP: Brief ──── */}
        {currentContent === "brief" && (
          <Card>
            <CardHeader>
              <CardTitle>Brief du projet</CardTitle>
              <CardDescription>
                {creationMode === "corpus" && extractedFields.length > 0
                  ? "Les valeurs ci-dessous ont été extraites de vos documents. Validez, éditez ou complétez."
                  : "Décrivez votre idée — l'IA s'occupe du reste"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Extracted fields from corpus */}
              {creationMode === "corpus" && extractedFields.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Données extraites de vos documents
                  </Label>
                  {extractedFields.map((field) => (
                    <ExtractedField
                      key={field.key}
                      field={field}
                      onAccept={handleAcceptField}
                      onReject={handleRejectField}
                    />
                  ))}
                </div>
              )}

              {/* Missing info */}
              {creationMode === "corpus" && extractionResult?.missingFields && (
                <MissingInfoAlert missing={extractionResult.missingFields} />
              )}

              {/* Manual title (always editable) */}
              <div className="space-y-2">
                <Label>
                  Titre *
                  {creationMode === "corpus" && title && acceptedFields["title"] && (
                    <Badge variant="secondary" className="ml-2 text-xs">Extrait</Badge>
                  )}
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Mon projet"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    Synopsis / Brief
                    {creationMode === "corpus" && synopsis && acceptedFields["synopsis"] && (
                      <Badge variant="secondary" className="ml-2 text-xs">Extrait</Badge>
                    )}
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEnrichSynopsis}
                    disabled={!synopsis.trim() || enriching}
                    className="text-primary hover:text-primary/80 gap-1.5 h-8 text-xs"
                  >
                    {enriching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                    Enrichir avec l'IA
                  </Button>
                </div>
                <Textarea
                  value={synopsis}
                  onChange={(e) => setSynopsis(e.target.value)}
                  placeholder="Décrivez votre idée, l'univers, les personnages…"
                  rows={6}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  {creationMode === "corpus"
                    ? "Modifiez le texte extrait ou enrichissez-le avec l'IA."
                    : "Écrivez quelques lignes puis cliquez « Enrichir avec l'IA » pour développer votre brief."}
                </p>
              </div>

              {/* Characters preview from corpus */}
              {creationMode === "corpus" && extractionResult && extractionResult.characters.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Personnages détectés
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {extractionResult.characters.map((c) => (
                      <Badge key={c.name} variant="outline" className="text-sm">
                        {c.name}
                        {c.role && (
                          <span className="text-muted-foreground ml-1">({c.role})</span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Episodes preview from corpus */}
              {creationMode === "corpus" &&
                extractionResult &&
                extractionResult.episodes.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Épisodes détectés ({extractionResult.episodes.length})
                    </Label>
                    <div className="space-y-1">
                      {extractionResult.episodes.slice(0, 6).map((ep, i) => (
                        <div key={i} className="text-sm flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs w-8 justify-center">
                            {ep.number || i + 1}
                          </Badge>
                          <span>{ep.title}</span>
                        </div>
                      ))}
                      {extractionResult.episodes.length > 6 && (
                        <p className="text-xs text-muted-foreground">
                          +{extractionResult.episodes.length - 6} épisodes supplémentaires
                        </p>
                      )}
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>
        )}

        {/* ──── STEP: Params ──── */}
        {currentContent === "params" && (
          <Card>
            <CardHeader>
              <CardTitle>Paramètres techniques</CardTitle>
              <CardDescription>Durée, format et fichiers source</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" /> Durée cible
                </Label>
                <Select value={durationMin} onValueChange={setDurationMin}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {projectType === "music_video" ? (
                      <>
                        <SelectItem value="3">3 min</SelectItem>
                        <SelectItem value="4">4 min</SelectItem>
                        <SelectItem value="5">5 min</SelectItem>
                      </>
                    ) : projectType === "series" ? (
                      <>
                        <SelectItem value="5">5 min</SelectItem>
                        <SelectItem value="10">10 min</SelectItem>
                        <SelectItem value="22">22 min</SelectItem>
                        <SelectItem value="25">25 min</SelectItem>
                        <SelectItem value="45">45 min</SelectItem>
                        <SelectItem value="50">50 min</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="2">2 min</SelectItem>
                        <SelectItem value="5">5 min</SelectItem>
                        <SelectItem value="10">10 min</SelectItem>
                        <SelectItem value="20">20 min</SelectItem>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="60">60 min</SelectItem>
                        <SelectItem value="90">90 min</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Format / Ratio</Label>
                <div className="grid grid-cols-3 gap-3">
                  {ASPECT_RATIOS.map((ar) => {
                    const Icon = ar.icon;
                    const selected = aspectRatio === ar.value;
                    return (
                      <button
                        key={ar.value}
                        onClick={() => setAspectRatio(ar.value)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border/50 hover:border-primary/30"
                        }`}
                      >
                        <Icon
                          className={`h-6 w-6 ${
                            selected ? "text-primary" : "text-muted-foreground"
                          }`}
                        />
                        <span
                          className={`text-sm font-semibold ${
                            selected ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {ar.label}
                        </span>
                        <span className="text-xs text-muted-foreground">{ar.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {projectType === "music_video" && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Music className="h-4 w-4 text-primary" /> Audio *
                  </Label>
                  <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 cursor-pointer hover:border-primary/50 transition-colors">
                    {audioFile ? (
                      <div className="flex items-center gap-2 text-primary">
                        <Music className="h-5 w-5" />
                        <span className="font-medium">{audioFile.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(audioFile.size / 1024 / 1024).toFixed(1)} Mo)
                        </span>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">MP3 ou WAV</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              )}

              {projectType === "hybrid_video" && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-primary" /> Vidéo source *
                  </Label>
                  <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 cursor-pointer hover:border-primary/50 transition-colors">
                    {videoFile ? (
                      <div className="flex items-center gap-2 text-primary">
                        <Video className="h-5 w-5" />
                        <span className="font-medium">{videoFile.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(videoFile.size / 1024 / 1024).toFixed(1)} Mo)
                        </span>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">MP4, MOV ou WebM</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ──── STEP: Style & Quality ──── */}
        {currentContent === "style" && (
          <Card>
            <CardHeader>
              <CardTitle>Style visuel & Qualité</CardTitle>
              <CardDescription>Choisissez l'esthétique et le niveau de rendu</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-3">
                <Label>Style visuel</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {STYLES.map((s) => {
                    const selected = style === s.value;
                    return (
                      <button
                        key={s.value}
                        onClick={() => setStyle(s.value)}
                        className={`group relative rounded-xl overflow-hidden border-2 transition-all aspect-square ${
                          selected
                            ? "border-primary ring-2 ring-primary/30 shadow-lg"
                            : "border-border/50 hover:border-primary/30"
                        }`}
                      >
                        <img
                          src={s.img}
                          alt={s.label}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <span
                          className={`absolute bottom-2 left-0 right-0 text-center text-xs font-semibold ${
                            selected ? "text-primary" : "text-white"
                          }`}
                        >
                          {s.label}
                        </span>
                        {selected && (
                          <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Niveau de qualité</Label>
                {QUALITY_TIERS.map((q) => (
                  <label
                    key={q.value}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      qualityTier === q.value
                        ? "border-primary bg-primary/5"
                        : "border-border/50 hover:border-primary/30"
                    }`}
                    onClick={() => setQualityTier(q.value)}
                  >
                    <div
                      className={`h-4 w-4 rounded-full border-2 flex-shrink-0 ${
                        qualityTier === q.value
                          ? "border-primary bg-primary"
                          : "border-muted-foreground"
                      }`}
                    />
                    <div className="flex-1">
                      <span className="font-medium">{q.label}</span>
                      <p className="text-xs text-muted-foreground">{q.desc}</p>
                    </div>
                    <Badge variant="outline" className="text-xs gap-1">
                      <Coins className="h-3 w-3" /> ~{q.creditsPerMin}/min
                    </Badge>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ──── STEP: Identity ──── */}
        {currentContent === "identity" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <CardTitle>Identité visuelle</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  Optionnel
                </Badge>
              </div>
              <CardDescription>
                {creationMode === "corpus" && extractionResult && extractionResult.characters.length > 0
                  ? "Ajoutez des photos de référence pour les personnages et décors détectés dans vos documents."
                  : "Uploadez des photos de référence pour les personnages, décors ou ambiances."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                {refPhotos.map((file, i) => (
                  <div key={i} className="relative group rounded-lg border overflow-hidden h-24 w-24">
                    <img
                      src={URL.createObjectURL(file)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <button
                      onClick={() => removeRef(i)}
                      aria-label="Supprimer la référence"
                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {refPhotos.length < 10 && (
                  <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed h-24 w-24 cursor-pointer hover:border-primary/50 transition-colors">
                    <ImagePlus className="h-6 w-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground mt-1">Ajouter</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => addRefPhotos(e.target.files)}
                    />
                  </label>
                )}
              </div>
              {refPhotos.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4 bg-secondary/30 rounded-lg">
                  Aucune référence ajoutée — pas de souci, l'IA générera les visuels à partir de votre
                  brief.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ──── STEP: Confirm ──── */}
        {currentContent === "confirm" && (
          <Card>
            <CardHeader>
              <CardTitle>Résumé du projet</CardTitle>
              <CardDescription>Vérifiez les paramètres avant de lancer la création</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Type</span>
                  <p className="font-medium mt-0.5">
                    {PROJECT_TYPES.find((t) => t.value === projectType)?.label}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Mode</span>
                  <p className="font-medium mt-0.5">
                    {creationMode === "corpus" ? "Depuis corpus" : "Depuis zéro"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Titre</span>
                  <p className="font-medium mt-0.5">{title || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Durée</span>
                  <p className="font-medium mt-0.5">{durationMin} min</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Format</span>
                  <p className="font-medium mt-0.5">{aspectRatio}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Style</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <img
                      src={STYLES.find((s) => s.value === style)?.img}
                      alt=""
                      className="h-6 w-6 rounded object-cover"
                    />
                    <span className="font-medium">
                      {STYLES.find((s) => s.value === style)?.label}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Qualité</span>
                  <p className="font-medium mt-0.5">
                    {QUALITY_TIERS.find((q) => q.value === qualityTier)?.label}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">
                    Références
                  </span>
                  <p className="font-medium mt-0.5">{refPhotos.length} photo(s)</p>
                </div>
                {audioFile && (
                  <div>
                    <span className="text-muted-foreground text-xs uppercase tracking-wide">Audio</span>
                    <p className="font-medium mt-0.5">{audioFile.name}</p>
                  </div>
                )}
              </div>

              {/* Corpus summary */}
              {creationMode === "corpus" && extractionResult && (
                <div className="rounded-lg border p-4 bg-secondary/30 space-y-2">
                  <p className="text-sm font-medium">
                    Corpus importé : {extractionResult.documentsProcessed} document(s)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {extractionResult.totalEntities} entités extraites
                    {extractionResult.characters.length > 0 &&
                      ` · ${extractionResult.characters.length} personnage(s)`}
                    {extractionResult.episodes.length > 0 &&
                      ` · ${extractionResult.episodes.length} épisode(s)`}
                  </p>
                </div>
              )}

              {synopsis && (
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">
                    Synopsis
                  </span>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{synopsis}</p>
                </div>
              )}

              {/* Cost estimation */}
              <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Coins className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-lg">~{estimatedCredits} crédits</p>
                  <p className="text-xs text-muted-foreground">
                    Estimation basée sur {durationMin} min en qualité{" "}
                    {QUALITY_TIERS.find((q) => q.value === qualityTier)?.label?.toLowerCase()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 mb-12">
          <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Précédent
          </Button>
          {step < wizardSteps.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext(step)}>
              Suivant <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button variant="hero" onClick={handleCreate} disabled={loading || !title.trim()}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {loading ? "Création…" : "Créer le projet"}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
