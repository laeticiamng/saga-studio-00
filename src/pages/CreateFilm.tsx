import { useState, useEffect, useCallback } from "react";
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
import { Film, Coins, Loader2, Cpu, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";

const PROVIDER_LABELS: Record<string, string> = {
  auto: "Auto",
  openai: "Sora 2",
  runway: "Runway",
  luma: "Luma",
  google_veo: "Veo",
};

export default function CreateFilm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [duration, setDuration] = useState("120");
  const [style, setStyle] = useState("cinematic");
  const [provider, setProvider] = useState("auto");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState<{ estimated_shots: number; estimated_credits: number } | null>(null);
  const [estimating, setEstimating] = useState(false);

  const fetchEstimate = useCallback(async () => {
    setEstimating(true);
    try {
      const providerKey = provider === "auto" ? "sora" : provider === "openai" ? "sora" : provider === "google_veo" ? "veo" : provider;
      const { data } = await supabase.functions.invoke("estimate-cost", {
        body: { duration_sec: parseInt(duration), provider: providerKey },
      });
      if (data) setEstimate(data);
    } catch {
      // fallback
    } finally {
      setEstimating(false);
    }
  }, [duration, provider]);

  useEffect(() => {
    fetchEstimate();
  }, [fetchEstimate]);

  const durationSec = parseInt(duration);
  const estimatedShots = estimate?.estimated_shots ?? Math.ceil(durationSec / 7);
  const estimatedCredits = estimate?.estimated_credits ?? (10 + estimatedShots * 2);

  const handleOneClickGenerate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Use create-project edge function for proper credit debit
      const { data, error } = await supabase.functions.invoke("create-project", {
        body: {
          type: "film",
          title,
          synopsis,
          style_preset: style,
          duration_sec: durationSec,
          mode: "story",
          aspect_ratio: aspectRatio,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const project = data.project;

      // Update to planning status and set provider
      await supabase.from("projects").update({
        status: "planning" as const,
        provider_default: provider === "auto" ? null : provider,
      }).eq("id", project.id);

      toast({ title: "🎬 Pipeline lancé !", description: "Votre film est en cours de génération…" });
      navigate(`/project/${project.id}`);

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
        <h1 className="text-3xl font-bold mb-2">Générer un film</h1>
        <p className="text-muted-foreground mb-8">Décrivez votre histoire et l'IA lui donnera vie</p>

        <Card className="border-border/50 bg-card/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Film className="h-5 w-5 text-primary" /> Détails du film</CardTitle>
            <CardDescription>Parlez-nous de votre court-métrage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Titre</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Le Dernier Signal" required />
            </div>
            <div className="space-y-2">
              <Label>Synopsis (5-8 lignes)</Label>
              <Textarea value={synopsis} onChange={(e) => setSynopsis(e.target.value)} placeholder="Dans un monde où…" rows={6} required />
            </div>
            <div className="space-y-2">
              <Label>Durée</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">1 minute</SelectItem>
                  <SelectItem value="120">2 minutes</SelectItem>
                  <SelectItem value="180">3 minutes</SelectItem>
                  <SelectItem value="240">4 minutes</SelectItem>
                  <SelectItem value="300">5 minutes</SelectItem>
                  <SelectItem value="360">6 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Style</Label>
              <StylePresetPicker value={style} onChange={setStyle} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Cpu className="h-3.5 w-3.5 text-primary" /> Fournisseur vidéo</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (meilleur disponible)</SelectItem>
                  <SelectItem value="openai">OpenAI Sora 2</SelectItem>
                  <SelectItem value="runway">Runway Gen-4</SelectItem>
                  <SelectItem value="luma">Luma Dream Machine</SelectItem>
                  <SelectItem value="google_veo">Google Veo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Format d'export</Label>
              <RadioGroup value={aspectRatio} onValueChange={setAspectRatio} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="16:9" id="r-landscape" />
                  <Label htmlFor="r-landscape" className="cursor-pointer">16:9 Paysage</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="9:16" id="r-portrait" />
                  <Label htmlFor="r-portrait" className="cursor-pointer">9:16 Portrait</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="both" id="r-both" />
                  <Label htmlFor="r-both" className="cursor-pointer">Les deux</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="rounded-xl bg-secondary/50 p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fournisseur</span>
                <span>{PROVIDER_LABELS[provider]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plans estimés</span>
                <span>~{estimatedShots}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="flex items-center gap-1"><Coins className="h-4 w-4 text-primary" /> Coût estimé</span>
                <span className="text-primary flex items-center gap-1">
                  {estimating && <Loader2 className="h-3 w-3 animate-spin" />}
                  {estimatedCredits} crédits
                </span>
              </div>
            </div>

            <Button variant="hero" className="w-full" onClick={handleOneClickGenerate} disabled={loading || !title || !synopsis}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {loading ? "Lancement du pipeline…" : "Générer mon film"}
            </Button>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
