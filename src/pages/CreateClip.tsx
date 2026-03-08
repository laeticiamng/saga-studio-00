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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Upload, Music, ArrowRight, ArrowLeft, Coins, Loader2, Cpu, Sparkles, ImagePlus, Video, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";

const STEPS = ["Médias", "Mode & Style", "Confirmer"];

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
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState<{ estimated_shots: number; estimated_credits: number } | null>(null);
  const [estimating, setEstimating] = useState(false);

  // Object URL management to prevent memory leaks
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
      const providerKey = provider === "auto" ? "sora" : provider === "openai" ? "sora" : provider === "google_veo" ? "veo" : provider;
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

  useEffect(() => {
    fetchEstimate();
  }, [fetchEstimate]);

  const estimatedShots = estimate?.estimated_shots ?? (audioFile ? Math.ceil((audioFile.size / 100000) * 5) : 30);
  const estimatedCredits = estimate?.estimated_credits ?? (5 + estimatedShots * 2);

  const addFaceFiles = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).slice(0, 5 - faceFiles.length);
    setFaceFiles(prev => [...prev, ...newFiles]);
  };

  const removeFaceFile = (idx: number) => {
    setFaceFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const addRefPhotos = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).slice(0, 10 - refPhotos.length);
    setRefPhotos(prev => [...prev, ...newFiles]);
  };

  const removeRefPhoto = (idx: number) => {
    setRefPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  const handleOneClickGenerate = async () => {
    if (!user || !audioFile) return;
    setLoading(true);
    try {
      // 1. Upload audio
      const filePath = `${user.id}/${Date.now()}-${audioFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("audio-uploads")
        .upload(filePath, audioFile);
      if (uploadError) throw uploadError;

      // 2. Upload face references
      const faceUrls: string[] = [];
      for (const file of faceFiles) {
        const facePath = `${user.id}/${Date.now()}-${file.name}`;
        const { error: faceErr } = await supabase.storage
          .from("face-references")
          .upload(facePath, file);
        if (!faceErr) faceUrls.push(facePath);
      }

      // 3. Upload reference photos to shot-outputs (public)
      const refUrls: string[] = [];
      for (const file of refPhotos) {
        const refPath = `${user.id}/refs/${Date.now()}-${file.name}`;
        const { error: refErr } = await supabase.storage
          .from("shot-outputs")
          .upload(refPath, file);
        if (!refErr) refUrls.push(refPath);
      }

      // 4. Create project via edge function (handles credit debit)
      const { data, error } = await supabase.functions.invoke("create-project", {
        body: {
          type: "clip",
          title: title || audioFile.name.replace(/\.[^/.]+$/, ""),
          mode,
          style_preset: style,
          audio_url: filePath,
          duration_sec: Math.min(270, Math.max(30, Math.round(audioFile.size / 16000))),
          aspect_ratio: aspectRatio,
          face_urls: faceUrls,
          ref_photo_urls: refUrls,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const project = data.project;

      // Update status to analyzing to start pipeline
      await supabase.from("projects").update({ status: "analyzing" as const }).eq("id", project.id);

      toast({ title: "🎬 C'est parti !", description: "Votre clip est en cours de création. Suivez l'avancement en temps réel." });
      navigate(`/project/${project.id}`);

      // Fire pipeline-worker in background
      supabase.functions.invoke("pipeline-worker", {
        body: { project_id: project.id },
      }).catch(console.error);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Générer un clip</h1>
        <p className="text-muted-foreground mb-8">Importez votre musique, vos visages et laissez l'IA créer votre clip vidéo</p>

        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${i <= step ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                {i + 1}
              </div>
              <span className={`text-sm ${i <= step ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
              {i < STEPS.length - 1 && <div className="h-px w-8 bg-border" />}
            </div>
          ))}
        </div>

        {step === 0 && (
          <Card className="border-border/50 bg-card/60">
            <CardHeader>
              <CardTitle>Importer vos médias</CardTitle>
              <CardDescription>Musique, photos/vidéos de visages et références visuelles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Titre du projet</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mon super clip" />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Music className="h-4 w-4 text-primary" /> Musique *</Label>
                <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/50 bg-card/20 p-8 cursor-pointer hover:border-primary/50 transition-colors">
                  {audioFile ? (
                    <div className="flex items-center gap-2 text-primary">
                      <Music className="h-6 w-6" />
                      <span className="font-medium">{audioFile.name}</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                      <span className="text-muted-foreground">Déposez votre fichier audio ou cliquez pour parcourir</span>
                      <span className="text-xs text-muted-foreground mt-1">MP3 ou WAV, max 4:30</span>
                    </>
                  )}
                  <input type="file" accept="audio/*" className="hidden" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
                </label>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Video className="h-4 w-4 text-primary" /> Visages (photos/vidéos)</Label>
                <p className="text-xs text-muted-foreground">Importez jusqu'à 5 photos ou vidéos de visages à intégrer dans votre clip</p>
                <div className="flex flex-wrap gap-3">
                  {faceFiles.map((file, i) => (
                    <div key={i} className="relative group rounded-lg border border-border/50 bg-card/40 p-2 flex items-center gap-2">
                      {faceObjectUrls[i] ? (
                        <img src={faceObjectUrls[i]!} alt="" className="h-12 w-12 rounded object-cover" />
                      ) : (
                        <Video className="h-12 w-12 text-muted-foreground p-2" />
                      )}
                      <span className="text-xs max-w-[100px] truncate">{file.name}</span>
                      <button
                        onClick={() => removeFaceFile(i)}
                        className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {faceFiles.length < 5 && (
                    <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/50 bg-card/20 p-4 cursor-pointer hover:border-primary/50 transition-colors min-w-[100px]">
                      <ImagePlus className="h-6 w-6 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">Ajouter</span>
                      <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => addFaceFiles(e.target.files)} />
                    </label>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><ImagePlus className="h-4 w-4 text-primary" /> Photos de référence (optionnel)</Label>
                <p className="text-xs text-muted-foreground">Ajoutez des images d'inspiration pour guider le style visuel</p>
                <div className="flex flex-wrap gap-3">
                  {refPhotos.map((file, i) => (
                    <div key={i} className="relative group rounded-lg border border-border/50 bg-card/40 overflow-hidden">
                      <img src={refObjectUrls[i]} alt="" className="h-16 w-16 object-cover" />
                      <button
                        onClick={() => removeRefPhoto(i)}
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {refPhotos.length < 10 && (
                    <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/50 bg-card/20 h-16 w-16 cursor-pointer hover:border-primary/50 transition-colors">
                      <ImagePlus className="h-5 w-5 text-muted-foreground" />
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addRefPhotos(e.target.files)} />
                    </label>
                  )}
                </div>
              </div>

              <Button variant="hero" className="w-full" onClick={() => setStep(1)} disabled={!audioFile}>
                Suivant <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card className="border-border/50 bg-card/60">
            <CardHeader>
              <CardTitle>Mode & Style</CardTitle>
              <CardDescription>Choisissez le rendu visuel de votre clip</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="story">Story — Arc narratif avec personnages</SelectItem>
                    <SelectItem value="performance">Performance — Style live / concert</SelectItem>
                    <SelectItem value="abstract">Abstrait — Art visuel, sans narration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Style visuel</Label>
                <StylePresetPicker value={style} onChange={setStyle} />
              </div>
              <div className="space-y-2">
              <details className="group">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-primary" /> Options avancées
                </summary>
                <div className="mt-3 space-y-2">
                  <Label>Moteur IA</Label>
                  <Select value={provider} onValueChange={setProvider}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Automatique (recommandé)</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="runway">Runway Gen-4</SelectItem>
                      <SelectItem value="luma">Luma Dream Machine</SelectItem>
                      <SelectItem value="google_veo">Google Veo</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">En mode automatique, le meilleur moteur est choisi pour vous.</p>
                </div>
              </details>
              </div>
              <div className="space-y-2">
                <Label>Format d'export</Label>
                <RadioGroup value={aspectRatio} onValueChange={setAspectRatio} className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="16:9" id="clip-landscape" />
                    <Label htmlFor="clip-landscape" className="cursor-pointer">16:9</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="9:16" id="clip-portrait" />
                    <Label htmlFor="clip-portrait" className="cursor-pointer">9:16</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="both" id="clip-both" />
                    <Label htmlFor="clip-both" className="cursor-pointer">Les deux</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setStep(0)}><ArrowLeft className="h-4 w-4 mr-2" /> Retour</Button>
                <Button variant="hero" className="flex-1" onClick={() => setStep(2)}>
                  Suivant <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="border-border/50 bg-card/60">
            <CardHeader>
              <CardTitle>Confirmer & Générer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl bg-secondary/50 p-4 space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Musique</span><span>{audioFile?.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Visages</span><span>{faceFiles.length > 0 ? `${faceFiles.length} fichier(s)` : "Aucun"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Références</span><span>{refPhotos.length > 0 ? `${refPhotos.length} photo(s)` : "Aucune"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Mode</span><span className="capitalize">{mode === "story" ? "Narratif" : mode === "performance" ? "Performance" : mode === "abstract" ? "Abstrait" : mode}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Style</span><span className="capitalize">{{"cinematic":"Cinématique","anime":"Anime","watercolor":"Aquarelle","3d_render":"Rendu 3D","noir":"Noir","vintage":"Vintage","neon":"Néon","realistic":"Réaliste","hyperpop":"Hyperpop","afrofuturism":"Afrofuturisme","synthwave":"Synthwave","documentary":"Documentaire","fantasy":"Fantaisie"}[style] || style}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Format</span><span>{aspectRatio}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Scènes estimées</span><span>~{estimatedShots}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Temps estimé</span><span>~5-15 min</span></div>
                <div className="flex justify-between border-t border-border pt-2 font-medium">
                  <span className="flex items-center gap-1"><Coins className="h-4 w-4 text-primary" /> Coût estimé</span>
                  <span className="text-primary flex items-center gap-1">
                    {estimating && <Loader2 className="h-3 w-3 animate-spin" />}
                    {estimatedCredits} crédits
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-2" /> Retour</Button>
                <Button variant="hero" className="flex-1" onClick={handleOneClickGenerate} disabled={loading}>
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
