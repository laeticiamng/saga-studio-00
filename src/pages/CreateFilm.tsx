import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import StylePresetPicker from "@/components/StylePresetPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Film, Coins, Loader2, Cpu, Sparkles, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { logger } from "@/lib/logger";

const PROVIDER_LABELS: Record<string, string> = {
  auto: "Auto (recommandé)",
  openai_image: "OpenAI — Images (DALL-E 3)",
  runway: "Runway — Vidéo (Gen-4.5)",
  luma: "Luma — Vidéo (Dream Machine)",
};

export default function CreateFilm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  usePageTitle("Générer un film");
  const [title, setTitle] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [duration, setDuration] = useState("120");
  const [style, setStyle] = useState("cinematic");
  const [provider, setProvider] = useState("auto");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichedData, setEnrichedData] = useState<Record<string, unknown> | null>(null);
  const [estimate, setEstimate] = useState<{ estimated_shots: number; estimated_credits: number } | null>(null);
  const [estimating, setEstimating] = useState(false);

  const fetchEstimate = useCallback(async () => {
    setEstimating(true);
    try {
      const providerKey = provider === "auto" ? "openai_image" : provider;
      const { data } = await supabase.functions.invoke("estimate-cost", {
        body: { duration_sec: parseInt(duration), provider: providerKey },
      });
      if (data) setEstimate(data);
    } catch (err: unknown) {
      logger.warn("CreateFilm", "Cost estimate failed, using fallback:", err);
    } finally {
      setEstimating(false);
    }
  }, [duration, provider]);

  useEffect(() => { fetchEstimate(); }, [fetchEstimate]);

  const durationSec = parseInt(duration);
  const estimatedShots = estimate?.estimated_shots ?? Math.ceil(durationSec / 7);
  const estimatedCredits = estimate?.estimated_credits ?? (10 + estimatedShots * 2);

  const handleEnrichWithAI = async () => {
    const idea = synopsis.length > 0 ? synopsis : title;
    if (!idea || idea.length < 3) {
      toast({ title: "Besoin d'une idée", description: "Écrivez au moins quelques mots dans le titre ou le synopsis pour que l'IA puisse travailler.", variant: "destructive" });
      return;
    }
    setEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke("enhance-synopsis", {
        body: { idea, type: "film", duration_sec: durationSec, style_preset: style },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.synopsis) {
        setSynopsis(data.synopsis);
        setEnrichedData(data);
        if (data.logline && !title) setTitle(data.logline.slice(0, 80));
        toast({ title: "✨ Synopsis enrichi", description: "L'IA a structuré votre idée en un synopsis cinématographique complet." });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Une erreur inattendue s'est produite";
      toast({ title: "Erreur IA", description: message, variant: "destructive" });
    } finally {
      setEnriching(false);
    }
  };

  const handleOneClickGenerate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-project", {
        body: {
          type: "film", title, synopsis, style_preset: style,
          duration_sec: durationSec, mode: "story", aspect_ratio: aspectRatio,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const project = data.project;
      await supabase.from("projects").update({
        status: "planning" as const,
        provider_default: provider === "auto" ? null : provider,
      }).eq("id", project.id);

      toast({ title: "🎬 C'est parti !", description: "Votre film est en cours de création. Suivez l'avancement en temps réel." });
      navigate(`/project/${project.id}`);

      supabase.functions.invoke("pipeline-worker", { body: { project_id: project.id } }).catch((e: unknown) => logger.error("CreateFilm", "pipeline-worker failed", e));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Une erreur inattendue s'est produite";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const synopsisValid = synopsis.length >= 50;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-2xl px-4 py-10 md:py-16">
        <Breadcrumbs items={[{ label: "Nouveau film" }]} />
        {/* Page Header */}
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Générer un film</h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-lg">
            Décrivez votre histoire et l'IA lui donnera vie en quelques minutes. Court-métrage de 1 à 6 minutes.
          </p>
        </div>

        <Card className="border-border/50 bg-card/60">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Film className="h-5 w-5 text-primary" /> Détails du film
            </CardTitle>
            <CardDescription className="text-sm">
              Renseignez le titre, le synopsis et les options de votre court-métrage. Plus le synopsis est détaillé, meilleur sera le résultat.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Titre */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Titre</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Le Dernier Signal" className="h-11" required />
              <p className="text-xs text-muted-foreground">Le titre apparaîtra sur la vidéo finale et dans votre tableau de bord.</p>
            </div>

            {/* Synopsis */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Synopsis</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleEnrichWithAI}
                  disabled={enriching || (!synopsis && !title)}
                  className="gap-1.5 text-xs h-8"
                >
                  {enriching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                  {enriching ? "Enrichissement…" : "Enrichir avec l'IA"}
                </Button>
              </div>
              <Textarea
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
                placeholder="Décrivez votre idée en quelques mots (ex: 'un robot qui découvre les émotions') puis cliquez sur 'Enrichir avec l'IA' pour obtenir un synopsis complet, ou écrivez directement votre synopsis détaillé…"
                rows={7}
                className="resize-none leading-relaxed"
                required
              />
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">
                  Décrivez l'histoire en 5 à 8 lignes, ou écrivez quelques mots et laissez l'IA enrichir.
                </p>
                <span className={`text-xs font-medium ${synopsisValid ? "text-primary" : synopsis.length > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  {synopsis.length}/50
                </span>
              </div>
              {synopsis.length > 0 && !synopsisValid && (
                <p className="text-xs text-destructive">Le synopsis doit contenir au moins 50 caractères.</p>
              )}
            </div>

            {/* AI Enrichment Details */}
            {enrichedData && (
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-3 text-sm">
                <p className="font-medium text-primary flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> Enrichissement IA
                </p>
                {enrichedData.logline && (
                  <div>
                    <span className="text-muted-foreground text-xs">Logline :</span>
                    <p className="text-foreground italic">{String(enrichedData.logline)}</p>
                  </div>
                )}
                {Array.isArray(enrichedData.characters) && enrichedData.characters.length > 0 && (
                  <div>
                    <span className="text-muted-foreground text-xs">Personnages :</span>
                    <div className="space-y-1 mt-1">
                      {(enrichedData.characters as Array<Record<string, unknown>>).map((c, i) => (
                        <p key={i} className="text-foreground text-xs">
                          <span className="font-medium">{String(c.name)}</span> ({String(c.role)}) — {String(c.want)}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                {enrichedData.ambiance && typeof enrichedData.ambiance === "object" && (
                  <div>
                    <span className="text-muted-foreground text-xs">Ambiance :</span>
                    <p className="text-foreground text-xs">
                      {String((enrichedData.ambiance as Record<string, unknown>).mood)} · {String((enrichedData.ambiance as Record<string, unknown>).lighting)} · Palette : {Array.isArray((enrichedData.ambiance as Record<string, unknown>).palette) ? ((enrichedData.ambiance as Record<string, unknown>).palette as string[]).join(", ") : ""}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Durée */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Durée</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">1 minute</SelectItem>
                  <SelectItem value="120">2 minutes</SelectItem>
                  <SelectItem value="180">3 minutes</SelectItem>
                  <SelectItem value="240">4 minutes</SelectItem>
                  <SelectItem value="300">5 minutes</SelectItem>
                  <SelectItem value="360">6 minutes</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Plus la durée est longue, plus le nombre de scènes et le coût en crédits augmentent.</p>
            </div>

            {/* Style */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Style visuel</Label>
              <StylePresetPicker value={style} onChange={setStyle} />
            </div>

            {/* Format d'export */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Format d'export</Label>
              <RadioGroup value={aspectRatio} onValueChange={setAspectRatio} className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="16:9" id="r-landscape" />
                  <Label htmlFor="r-landscape" className="cursor-pointer text-sm">16:9 Paysage</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="9:16" id="r-portrait" />
                  <Label htmlFor="r-portrait" className="cursor-pointer text-sm">9:16 Portrait</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="both" id="r-both" />
                  <Label htmlFor="r-both" className="cursor-pointer text-sm">Les deux</Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">16:9 pour YouTube, 9:16 pour TikTok / Reels, ou les deux formats.</p>
            </div>

            {/* Options avancées */}
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
                <p className="text-xs text-muted-foreground">En mode automatique, le meilleur moteur est choisi selon votre style et votre synopsis.</p>
              </div>
            </details>

            {/* Estimation */}
            <div className="rounded-xl bg-secondary/40 p-5 sm:p-6 space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Moteur IA</span>
                <span className="font-medium">{PROVIDER_LABELS[provider]}</span>
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
                  ~{estimatedCredits} crédits{!estimate && " (approx.)"}
                </span>
              </div>
            </div>

            {/* Submit */}
            <Button variant="hero" size="lg" className="w-full" onClick={handleOneClickGenerate} disabled={loading || !title || !synopsisValid}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {loading ? "Création en cours…" : "Générer mon film"}
            </Button>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
