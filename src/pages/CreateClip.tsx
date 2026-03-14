import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StylePresetPicker from "@/components/StylePresetPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Upload, Music, ArrowRight, ArrowLeft, Coins, Loader2, Cpu, Sparkles, ImagePlus, Video, X, Check, Palette } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";

const STEPS = [
  { label: "Médias", shortLabel: "1", description: "Musique & visuels" },
  { label: "Mode & Style", shortLabel: "2", description: "Personnalisation" },
  { label: "Confirmer", shortLabel: "3", description: "Résumé & lancement" },
];

const STYLE_LABELS: Record<string, string> = {
  cinematic: "Cinématique", anime: "Anime", watercolor: "Aquarelle", "3d_render": "Rendu 3D",
  noir: "Noir", vintage: "Vintage", neon: "Néon", realistic: "Réaliste", hyperpop: "Hyperpop",
  afrofuturism: "Afrofuturisme", synthwave: "Synthwave", documentary: "Documentaire", fantasy: "Fantaisie",
};

export default function CreateClip() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  usePageTitle("Générer un clip");
  const [step, setStep] = useState(0);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [faceFiles, setFaceFiles] = useState<File[]>([]);
  const [refPhotos, setRefPhotos] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState("story");
  const [style, setStyle] = useState("cinematic");
  const [provider, setProvider] = useState("auto");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [atmosphere, setAtmosphere] = useState("");
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState<{ estimated_shots: number; estimated_credits: number } | null>(null);
  const [estimating, setEstimating] = useState(false);

  const faceObjectUrls = useMemo(() => faceFiles.map(f => f.type.startsWith("image/") ? URL.createObjectURL(f) : null), [faceFiles]);
  const refObjectUrls = useMemo(() => refPhotos.map(f => URL.createObjectURL(f)), [refPhotos]);

  useEffect(() => {
    return () => {
      faceObjectUrls.forEach(url => url && URL.revokeObjectURL(url));
      refObjectUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [faceObjectUrls, refObjectUrls]);

  const fetchEstimate = useCallback(async () => {
    if (!audioFile) return;
    setEstimating(true);
    try {
      const durationSec = Math.min(270, Math.max(30, Math.round(audioFile.size / 16000)));
      const providerKey = provider === "auto" ? "openai_image" : provider;
      const { data } = await supabase.functions.invoke("estimate-cost", {
        body: { duration_sec: durationSec, provider: providerKey },
      });
      if (data) setEstimate(data);
    } catch {
      // fallback
    } finally {
      setEstimating(false);
    }
  }, [audioFile, provider]);

  useEffect(() => { fetchEstimate(); }, [fetchEstimate]);

  const estimatedShots = estimate?.estimated_shots ?? (audioFile ? Math.ceil((audioFile.size / 100000) * 5) : 30);
  const estimatedCredits = estimate?.estimated_credits ?? (5 + estimatedShots * 2);

  const addFaceFiles = (files: FileList | null) => {
    if (!files) return;
    setFaceFiles(prev => [...prev, ...Array.from(files).slice(0, 5 - prev.length)]);
  };
  const removeFaceFile = (idx: number) => setFaceFiles(prev => prev.filter((_, i) => i !== idx));
  const addRefPhotos = (files: FileList | null) => {
    if (!files) return;
    setRefPhotos(prev => [...prev, ...Array.from(files).slice(0, 10 - prev.length)]);
  };
  const removeRefPhoto = (idx: number) => setRefPhotos(prev => prev.filter((_, i) => i !== idx));

  const handleOneClickGenerate = async () => {
    if (!user || !audioFile) return;
    setLoading(true);
    try {
      const filePath = `${user.id}/${Date.now()}-${audioFile.name}`;
      const { error: uploadError } = await supabase.storage.from("audio-uploads").upload(filePath, audioFile);
      if (uploadError) throw uploadError;

      const faceUrls: string[] = [];
      for (const file of faceFiles) {
        const facePath = `${user.id}/${Date.now()}-${file.name}`;
        const { error: faceErr } = await supabase.storage.from("face-references").upload(facePath, file);
        if (!faceErr) faceUrls.push(facePath);
      }

      const refUrls: string[] = [];
      for (const file of refPhotos) {
        const refPath = `${user.id}/refs/${Date.now()}-${file.name}`;
        const { error: refErr } = await supabase.storage.from("shot-outputs").upload(refPath, file);
        if (!refErr) refUrls.push(refPath);
      }

      const { data, error } = await supabase.functions.invoke("create-project", {
        body: {
          type: "clip",
          title: title || audioFile.name.replace(/\.[^/.]+$/, ""),
          mode, style_preset: style, audio_url: filePath,
          duration_sec: Math.min(270, Math.max(30, Math.round(audioFile.size / 16000))),
          aspect_ratio: aspectRatio, face_urls: faceUrls, ref_photo_urls: refUrls,
          synopsis: atmosphere || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const project = data.project;
      await supabase.from("projects").update({ status: "analyzing" as const }).eq("id", project.id);

      toast({ title: "🎬 C'est parti !", description: "Votre clip est en cours de création. Suivez l'avancement en temps réel." });
      navigate(`/project/${project.id}`);

      supabase.functions.invoke("pipeline-worker", { body: { project_id: project.id } }).catch(console.error);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-2xl px-4 py-10 md:py-16">
        {/* Page Header */}
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Générer un clip</h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-lg">
            Importez votre musique, ajoutez vos visuels et laissez l'IA créer votre clip vidéo en quelques minutes.
          </p>
        </div>

        {/* Responsive Stepper */}
        <div className="flex items-center justify-between mb-10 relative">
          {/* Connecting line */}
          <div className="absolute top-5 left-0 right-0 h-px bg-border hidden sm:block" style={{ left: '2.5rem', right: '2.5rem' }} />
          {STEPS.map((s, i) => (
            <div key={s.label} className="flex flex-col items-center gap-1.5 relative z-10 flex-1">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 ${
                i < step ? "bg-primary text-primary-foreground" :
                i === step ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                "bg-secondary text-muted-foreground"
              }`}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-xs sm:text-sm font-medium text-center transition-colors ${
                i <= step ? "text-foreground" : "text-muted-foreground"
              }`}>
                {s.label}
              </span>
              <span className="text-[10px] text-muted-foreground hidden sm:block">{s.description}</span>
            </div>
          ))}
        </div>

        {/* Step 0 — Médias */}
        {step === 0 && (
          <Card className="border-border/50 bg-card/60">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Upload className="h-5 w-5 text-primary" /> Importer vos médias
              </CardTitle>
              <CardDescription className="text-sm">
                Commencez par ajouter votre musique. Vous pouvez aussi ajouter des visages et des références visuelles pour personnaliser le résultat.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Titre */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium">Titre du projet</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mon super clip" className="h-11" />
                <p className="text-xs text-muted-foreground">Donnez un nom à votre projet pour le retrouver facilement.</p>
              </div>

              {/* Audio */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Music className="h-4 w-4 text-primary" /> Musique <span className="text-destructive">*</span>
                </Label>
                <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/60 bg-secondary/30 p-8 sm:p-10 cursor-pointer hover:border-primary/50 hover:bg-secondary/50 transition-all duration-200">
                  {audioFile ? (
                    <div className="flex items-center gap-3 text-primary">
                      <Music className="h-6 w-6" />
                      <div>
                        <span className="font-medium block">{audioFile.name}</span>
                        <span className="text-xs text-muted-foreground">{(audioFile.size / 1024 / 1024).toFixed(1)} Mo</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                      <span className="text-sm text-foreground font-medium mb-1">Déposez votre fichier audio</span>
                      <span className="text-xs text-muted-foreground">ou cliquez pour parcourir · MP3, WAV · max 4 min 30</span>
                    </>
                  )}
                  <input type="file" accept="audio/*" className="hidden" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
                </label>
              </div>

              {/* Visages */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Video className="h-4 w-4 text-primary" /> Visages
                  <span className="text-xs font-normal text-muted-foreground ml-1">(optionnel)</span>
                </Label>
                <p className="text-xs text-muted-foreground -mt-1">
                  Ajoutez jusqu'à 5 photos ou vidéos de visages à intégrer dans votre clip. L'IA les reproduira dans les scènes générées.
                </p>
                <div className="flex flex-wrap gap-3">
                  {faceFiles.map((file, i) => (
                    <div key={i} className="relative group rounded-lg border border-border/50 bg-card/40 p-2 flex items-center gap-2">
                      {faceObjectUrls[i] ? (
                        <img src={faceObjectUrls[i]!} alt="" className="h-14 w-14 rounded-md object-cover" />
                      ) : (
                        <Video className="h-14 w-14 text-muted-foreground p-3" />
                      )}
                      <span className="text-xs max-w-[80px] truncate">{file.name}</span>
                      <button onClick={() => removeFaceFile(i)} className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {faceFiles.length < 5 && (
                    <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/50 bg-secondary/20 p-4 cursor-pointer hover:border-primary/50 transition-colors min-w-[90px] min-h-[90px]">
                      <ImagePlus className="h-6 w-6 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">Ajouter</span>
                      <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => addFaceFiles(e.target.files)} />
                    </label>
                  )}
                </div>
              </div>

              {/* Références visuelles */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <ImagePlus className="h-4 w-4 text-primary" /> Photos de référence
                  <span className="text-xs font-normal text-muted-foreground ml-1">(optionnel)</span>
                </Label>
                <p className="text-xs text-muted-foreground -mt-1">
                  Des images d'inspiration pour guider l'ambiance et le style visuel du clip.
                </p>
                <div className="flex flex-wrap gap-3">
                  {refPhotos.map((file, i) => (
                    <div key={i} className="relative group rounded-lg border border-border/50 bg-card/40 overflow-hidden">
                      <img src={refObjectUrls[i]} alt="" className="h-[72px] w-[72px] object-cover" />
                      <button onClick={() => removeRefPhoto(i)} className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {refPhotos.length < 10 && (
                    <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/50 bg-secondary/20 h-[72px] w-[72px] cursor-pointer hover:border-primary/50 transition-colors">
                      <ImagePlus className="h-5 w-5 text-muted-foreground" />
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addRefPhotos(e.target.files)} />
                    </label>
                  )}
                </div>
              </div>

              {/* Ambiance / Atmosphère */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Palette className="h-4 w-4 text-primary" /> Ambiance souhaitée
                  <span className="text-xs font-normal text-muted-foreground ml-1">(optionnel)</span>
                </Label>
                <Textarea
                  value={atmosphere}
                  onChange={(e) => setAtmosphere(e.target.value)}
                  placeholder="Ex: Ambiance nocturne urbaine, néons roses et bleus, pluie sur l'asphalte, feeling mélancolique et rêveur…"
                  rows={3}
                  className="resize-none text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Décrivez l'atmosphère, le décor ou l'émotion souhaitée. L'IA intégrera ces éléments dans chaque scène.
                </p>
              </div>

              <Button variant="hero" size="lg" className="w-full" onClick={() => setStep(1)} disabled={!audioFile}>
                Suivant <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 1 — Mode & Style */}
        {step === 1 && (
          <Card className="border-border/50 bg-card/60">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="h-5 w-5 text-primary" /> Mode & Style
              </CardTitle>
              <CardDescription className="text-sm">
                Choisissez le type de narration et le rendu visuel de votre clip. Chaque combinaison produit un résultat unique.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Mode de création</Label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="story">Story — Arc narratif avec personnages</SelectItem>
                    <SelectItem value="performance">Performance — Style live / concert</SelectItem>
                    <SelectItem value="abstract">Abstrait — Art visuel, sans narration</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {mode === "story" ? "L'IA construira une histoire avec des personnages et un fil conducteur." :
                   mode === "performance" ? "Ambiance scène, éclairages dynamiques, centré sur l'artiste." :
                   "Formes, couleurs et mouvements abstraits synchronisés sur la musique."}
                </p>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Style visuel</Label>
                <StylePresetPicker value={style} onChange={setStyle} />
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Format d'export</Label>
                <RadioGroup value={aspectRatio} onValueChange={setAspectRatio} className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="16:9" id="clip-landscape" />
                    <Label htmlFor="clip-landscape" className="cursor-pointer text-sm">16:9 Paysage</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="9:16" id="clip-portrait" />
                    <Label htmlFor="clip-portrait" className="cursor-pointer text-sm">9:16 Portrait</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="both" id="clip-both" />
                    <Label htmlFor="clip-both" className="cursor-pointer text-sm">Les deux</Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-muted-foreground">16:9 pour YouTube, 9:16 pour TikTok / Reels, ou les deux formats.</p>
              </div>

              <details className="group">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 py-2">
                  <Cpu className="h-3.5 w-3.5 text-primary" /> Options avancées
                </summary>
                <div className="mt-3 space-y-3 pl-5 border-l-2 border-border">
                  <Label className="text-sm font-medium">Moteur IA</Label>
                  <Select value={provider} onValueChange={setProvider}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Automatique (recommandé)</SelectItem>
                      <SelectItem value="openai_image">OpenAI — Images (DALL-E 3)</SelectItem>
                      <SelectItem value="runway">Runway — Vidéo (Gen-4.5)</SelectItem>
                      <SelectItem value="luma">Luma — Vidéo (Dream Machine)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">En mode automatique, le meilleur moteur est choisi selon votre style et votre musique.</p>
                </div>
              </details>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(0)} className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Retour
                </Button>
                <Button variant="hero" size="lg" className="flex-1" onClick={() => setStep(2)}>
                  Suivant <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2 — Confirmer */}
        {step === 2 && (
          <Card className="border-border/50 bg-card/60">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Coins className="h-5 w-5 text-primary" /> Confirmer & Générer
              </CardTitle>
              <CardDescription className="text-sm">
                Vérifiez les détails de votre clip avant de lancer la génération.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl bg-secondary/40 p-5 sm:p-6 space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Musique</span>
                  <span className="font-medium truncate max-w-[200px]">{audioFile?.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Visages</span>
                  <span>{faceFiles.length > 0 ? `${faceFiles.length} fichier(s)` : "Aucun"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Références</span>
                  <span>{refPhotos.length > 0 ? `${refPhotos.length} photo(s)` : "Aucune"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Mode</span>
                  <span>{mode === "story" ? "Narratif" : mode === "performance" ? "Performance" : "Abstrait"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Style</span>
                  <span>{STYLE_LABELS[style] || style}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Format</span>
                  <span>{aspectRatio === "both" ? "16:9 + 9:16" : aspectRatio}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Scènes estimées</span>
                  <span>~{estimatedShots}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Temps estimé</span>
                  <span>~5–15 min</span>
                </div>
                <div className="border-t border-border my-1" />
                <div className="flex justify-between items-center font-semibold text-base">
                  <span className="flex items-center gap-1.5">
                    <Coins className="h-4 w-4 text-primary" /> Coût estimé
                  </span>
                  <span className="text-primary flex items-center gap-1.5">
                    {estimating && <Loader2 className="h-3 w-3 animate-spin" />}
                    {estimatedCredits} crédits
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Retour
                </Button>
                <Button variant="hero" size="lg" className="flex-1" onClick={handleOneClickGenerate} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  {loading ? "Création en cours…" : "Générer mon clip"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
      <Footer />
    </div>
  );
}
