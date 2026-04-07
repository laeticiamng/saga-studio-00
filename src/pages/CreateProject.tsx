import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useCreateSeries } from "@/hooks/useSeries";
import { logger } from "@/lib/logger";
import {
  Film, Music, Tv, Upload, ArrowRight, ArrowLeft, Check,
  Loader2, Sparkles, Video, ImagePlus, X, Wand2,
} from "lucide-react";

type ProjectType = "series" | "film" | "music_video" | "hybrid_video";

const PROJECT_TYPES: { value: ProjectType; label: string; icon: React.ElementType; desc: string }[] = [
  { value: "series", label: "Série", icon: Tv, desc: "Épisodes multi-saisons avec continuité narrative" },
  { value: "film", label: "Film", icon: Film, desc: "Long-métrage ou court-métrage narratif" },
  { value: "music_video", label: "Clip Musical", icon: Music, desc: "Vidéo synchronisée au rythme musical" },
  { value: "hybrid_video", label: "Vidéo Hybride", icon: Video, desc: "Vidéo existante + améliorations IA" },
];

const QUALITY_TIERS = [
  { value: "premium", label: "Premium", desc: "Vidéo native, rendu serveur" },
  { value: "standard", label: "Standard", desc: "Recommandé — bon équilibre qualité/coût" },
  { value: "economy", label: "Économique", desc: "Plus rapide, assemblage navigateur" },
];

const STYLES = [
  { value: "cinematic", label: "Cinématique" },
  { value: "anime", label: "Anime" },
  { value: "realistic", label: "Réaliste" },
  { value: "noir", label: "Noir" },
  { value: "vintage", label: "Vintage" },
  { value: "neon", label: "Néon" },
  { value: "documentary", label: "Documentaire" },
  { value: "fantasy", label: "Fantaisie" },
  { value: "watercolor", label: "Aquarelle" },
  { value: "3d_render", label: "Rendu 3D" },
];

const WIZARD_STEPS = [
  { label: "Type", short: "1" },
  { label: "Brief", short: "2" },
  { label: "Style & Qualité", short: "3" },
  { label: "Identité", short: "4" },
  { label: "Confirmer", short: "5" },
];

export default function CreateProject() {
  usePageTitle("Nouveau projet");
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const createSeries = useCreateSeries();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1: Type
  const [projectType, setProjectType] = useState<ProjectType>("film");

  // Step 2: Brief
  const [title, setTitle] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [durationMin, setDurationMin] = useState("5");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  // Step 3: Style
  const [style, setStyle] = useState("cinematic");
  const [qualityTier, setQualityTier] = useState("standard");

  // Step 4: Identity
  const [refPhotos, setRefPhotos] = useState<File[]>([]);

  const addRefPhotos = (files: FileList | null) => {
    if (!files) return;
    setRefPhotos(prev => [...prev, ...Array.from(files).slice(0, 10 - prev.length)]);
  };
  const removeRef = (idx: number) => setRefPhotos(prev => prev.filter((_, i) => i !== idx));

  const canNext = (s: number): boolean => {
    if (s === 0) return !!projectType;
    if (s === 1) return title.trim().length > 0;
    if (s === 2) return true;
    if (s === 3) return true;
    return true;
  };

  const handleCreate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const durationSec = parseInt(durationMin) * 60;

      // Upload audio if music_video
      let audioUrl: string | undefined;
      if (audioFile && projectType === "music_video") {
        const path = `${user.id}/${Date.now()}-${audioFile.name}`;
        const { error: upErr } = await supabase.storage.from("audio-uploads").upload(path, audioFile);
        if (upErr) throw upErr;
        audioUrl = path;
      }

      // Upload ref photos
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
          episodes_per_season: 10,
        });
        toast({ title: "Série créée !" });
        navigate(`/series/${result.series.id}`);
        return;
      }

      // Film / music_video / hybrid_video
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
          {WIZARD_STEPS.map((s, i) => (
            <div key={s.label} className="flex flex-col items-center gap-1.5 relative z-10 flex-1">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all ${
                i < step ? "bg-primary text-primary-foreground" :
                i === step ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                "bg-secondary text-muted-foreground"
              }`}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-xs font-medium ${i <= step ? "text-foreground" : "text-muted-foreground"}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Step 0: Project Type */}
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {PROJECT_TYPES.map((pt) => {
              const Icon = pt.icon;
              const selected = projectType === pt.value;
              return (
                <Card
                  key={pt.value}
                  className={`cursor-pointer transition-all border-2 ${
                    selected ? "border-primary bg-primary/5 shadow-md" : "border-border/50 hover:border-primary/30"
                  }`}
                  onClick={() => setProjectType(pt.value)}
                >
                  <CardContent className="flex items-start gap-4 p-6">
                    <div className={`p-3 rounded-xl ${selected ? "bg-primary/10" : "bg-secondary"}`}>
                      <Icon className={`h-6 w-6 ${selected ? "text-primary" : "text-muted-foreground"}`} />
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
        )}

        {/* Step 1: Brief */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Brief du projet</CardTitle>
              <CardDescription>Décrivez votre projet — l'IA fera le reste</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Titre *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mon projet" />
              </div>
              <div className="space-y-2">
                <Label>Synopsis / Brief</Label>
                <Textarea value={synopsis} onChange={(e) => setSynopsis(e.target.value)}
                  placeholder="Décrivez votre idée, l'univers, les personnages…" rows={5} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Durée cible</Label>
                  <Select value={durationMin} onValueChange={setDurationMin}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <Label>Format</Label>
                  <RadioGroup value={aspectRatio} onValueChange={setAspectRatio} className="flex gap-4 pt-2">
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem value="16:9" id="ar-16" />
                      <Label htmlFor="ar-16" className="text-sm cursor-pointer">16:9</Label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem value="9:16" id="ar-9" />
                      <Label htmlFor="ar-9" className="text-sm cursor-pointer">9:16</Label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem value="1:1" id="ar-1" />
                      <Label htmlFor="ar-1" className="text-sm cursor-pointer">1:1</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              {projectType === "music_video" && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Music className="h-4 w-4 text-primary" /> Audio *</Label>
                  <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 cursor-pointer hover:border-primary/50 transition-colors">
                    {audioFile ? (
                      <div className="flex items-center gap-2 text-primary">
                        <Music className="h-5 w-5" />
                        <span className="font-medium">{audioFile.name}</span>
                        <span className="text-xs text-muted-foreground">({(audioFile.size / 1024 / 1024).toFixed(1)} Mo)</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">MP3 ou WAV</span>
                      </>
                    )}
                    <input type="file" accept="audio/*" className="hidden" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              )}

              {projectType === "hybrid_video" && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Video className="h-4 w-4 text-primary" /> Vidéo source *</Label>
                  <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 cursor-pointer hover:border-primary/50 transition-colors">
                    {videoFile ? (
                      <div className="flex items-center gap-2 text-primary">
                        <Video className="h-5 w-5" />
                        <span className="font-medium">{videoFile.name}</span>
                        <span className="text-xs text-muted-foreground">({(videoFile.size / 1024 / 1024).toFixed(1)} Mo)</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">MP4, MOV ou WebM</span>
                      </>
                    )}
                    <input type="file" accept="video/*" className="hidden" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Style & Quality */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Style visuel & Qualité</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Style visuel</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {STYLES.map((s) => (
                    <Button
                      key={s.value}
                      variant={style === s.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStyle(s.value)}
                      className="justify-start"
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <Label>Niveau de qualité</Label>
                {QUALITY_TIERS.map((q) => (
                  <label
                    key={q.value}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      qualityTier === q.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/30"
                    }`}
                    onClick={() => setQualityTier(q.value)}
                  >
                    <div className={`h-4 w-4 rounded-full border-2 ${
                      qualityTier === q.value ? "border-primary bg-primary" : "border-muted-foreground"
                    }`} />
                    <div>
                      <span className="font-medium">{q.label}</span>
                      <p className="text-xs text-muted-foreground">{q.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Identity */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Identité visuelle</CardTitle>
              <CardDescription>
                Uploadez des photos de référence pour les personnages, décors ou ambiances.
                Ces images guideront la génération pour maintenir la cohérence visuelle.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                {refPhotos.map((file, i) => (
                  <div key={i} className="relative group rounded-lg border overflow-hidden h-24 w-24">
                    <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                    <button
                      onClick={() => removeRef(i)}
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
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addRefPhotos(e.target.files)} />
                  </label>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Optionnel — vous pourrez aussi générer des références par IA dans l'étape suivante du projet.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Résumé du projet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Type</span>
                  <p className="font-medium">{PROJECT_TYPES.find(t => t.value === projectType)?.label}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Titre</span>
                  <p className="font-medium">{title || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Durée</span>
                  <p className="font-medium">{durationMin} min</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Format</span>
                  <p className="font-medium">{aspectRatio}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Style</span>
                  <p className="font-medium">{STYLES.find(s => s.value === style)?.label}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Qualité</span>
                  <p className="font-medium">{QUALITY_TIERS.find(q => q.value === qualityTier)?.label}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Références</span>
                  <p className="font-medium">{refPhotos.length} photo(s)</p>
                </div>
                {audioFile && (
                  <div>
                    <span className="text-muted-foreground">Audio</span>
                    <p className="font-medium">{audioFile.name}</p>
                  </div>
                )}
              </div>
              {synopsis && (
                <div>
                  <span className="text-sm text-muted-foreground">Synopsis</span>
                  <p className="text-sm mt-1">{synopsis}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Précédent
          </Button>
          {step < WIZARD_STEPS.length - 1 ? (
            <Button onClick={() => setStep(s => s + 1)} disabled={!canNext(step)}>
              Suivant <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button variant="hero" onClick={handleCreate} disabled={loading || !title.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {loading ? "Création…" : "Créer le projet"}
            </Button>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
