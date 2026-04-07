import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useUpdateTimeline } from "@/hooks/useTimelines";
import { useToast } from "@/hooks/use-toast";
import { Palette, Sun, Contrast, Sparkles, Film } from "lucide-react";

const LOOK_PRESETS = [
  { value: "cinematic_soft", label: "Cinematic Soft", desc: "Tons chauds, contraste doux, ombres riches" },
  { value: "crisp_modern", label: "Crisp Modern", desc: "Net, couleurs vives, blancs propres" },
  { value: "dramatic_contrast", label: "Dramatic Contrast", desc: "Forts contrastes, noirs profonds, highlights intenses" },
  { value: "glossy_music_video", label: "Glossy Music Video", desc: "Saturé, brillant, reflets luxueux" },
  { value: "clean_neutral", label: "Clean Neutral", desc: "Minimal, pas de stylisation, fidèle aux sources" },
];

interface FinishingPanelProps {
  timeline: Record<string, unknown>;
  projectId: string;
}

export function FinishingPanel({ timeline, projectId }: FinishingPanelProps) {
  const updateTimeline = useUpdateTimeline();
  const { toast } = useToast();
  const currentPreset = String(timeline.look_preset || "");

  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [grain, setGrain] = useState(false);
  const [sharpen, setSharpen] = useState(false);

  const handleApplyPreset = async (preset: string) => {
    try {
      await updateTimeline.mutateAsync({
        id: String(timeline.id),
        look_preset: preset,
      });
      toast({ title: "Look appliqué", description: `Preset "${preset}" enregistré pour l'export` });
    } catch (err: unknown) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Look Presets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" /> Project Look
          </CardTitle>
          <CardDescription>
            Harmonisez l'ensemble du projet avec un preset visuel. Appliqué lors de l'export final.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {LOOK_PRESETS.map((preset) => (
            <label
              key={preset.value}
              className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                currentPreset === preset.value
                  ? "border-primary bg-primary/5"
                  : "border-border/50 hover:border-primary/30"
              }`}
              onClick={() => handleApplyPreset(preset.value)}
            >
              <div>
                <span className="font-medium text-sm">{preset.label}</span>
                <p className="text-xs text-muted-foreground">{preset.desc}</p>
              </div>
              {currentPreset === preset.value && (
                <Badge variant="default">Actif</Badge>
              )}
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Manual adjustments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sun className="h-4 w-4" /> Ajustements manuels
          </CardTitle>
          <CardDescription className="text-xs">
            Ajustements fins appliqués par-dessus le preset lors de l'export.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-xs">Luminosité</Label>
              <span className="text-xs text-muted-foreground">{brightness}%</span>
            </div>
            <Slider value={[brightness]} onValueChange={([v]) => setBrightness(v)} min={50} max={150} step={1} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-xs">Contraste</Label>
              <span className="text-xs text-muted-foreground">{contrast}%</span>
            </div>
            <Slider value={[contrast]} onValueChange={([v]) => setContrast(v)} min={50} max={150} step={1} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-xs">Saturation</Label>
              <span className="text-xs text-muted-foreground">{saturation}%</span>
            </div>
            <Slider value={[saturation]} onValueChange={([v]) => setSaturation(v)} min={0} max={200} step={1} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Grain film</Label>
            <Switch checked={grain} onCheckedChange={setGrain} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Sharpening</Label>
            <Switch checked={sharpen} onCheckedChange={setSharpen} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
