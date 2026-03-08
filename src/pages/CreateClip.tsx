import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import StylePresetPicker from "@/components/StylePresetPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Music, ArrowRight, ArrowLeft, Coins, Loader2, Cpu } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STEPS = ["Upload Audio", "Mode & Style", "Confirm"];

export default function CreateClip() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState("story");
  const [style, setStyle] = useState("cinematic");
  const [provider, setProvider] = useState("auto");
  const [loading, setLoading] = useState(false);

  const estimatedShots = audioFile ? Math.ceil((audioFile.size / 100000) * 5) : 30;
  const estimatedCredits = 5 + estimatedShots * 2;

  const handleCreate = async () => {
    if (!user || !audioFile) return;
    setLoading(true);
    try {
      // Upload audio
      const filePath = `${user.id}/${Date.now()}-${audioFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("audio-uploads")
        .upload(filePath, audioFile);
      if (uploadError) throw uploadError;

      const audioUrl = filePath;

      // Create project
      const { data: project, error } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          type: "clip" as const,
          title: title || audioFile.name.replace(/\.[^/.]+$/, ""),
          mode,
          style_preset: style,
          audio_url: audioUrl,
          provider_default: provider === "auto" ? null : provider,
          status: "draft" as const,
        })
        .select()
        .single();

      if (error) throw error;
      navigate(`/project/${project.id}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Generate a Clip</h1>
        <p className="text-muted-foreground mb-8">Upload your audio and let AI create a full music video</p>

        {/* Step indicators */}
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
              <CardTitle>Upload Audio</CardTitle>
              <CardDescription>MP3 or WAV file, max 4:30</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Project Title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My awesome clip" />
              </div>
              <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/50 bg-card/20 p-10 cursor-pointer hover:border-primary/50 transition-colors">
                {audioFile ? (
                  <div className="flex items-center gap-2 text-primary">
                    <Music className="h-6 w-6" />
                    <span className="font-medium">{audioFile.name}</span>
                  </div>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                    <span className="text-muted-foreground">Drop audio file or click to browse</span>
                  </>
                )}
                <input type="file" accept="audio/*" className="hidden" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
              </label>
              <Button variant="hero" className="w-full" onClick={() => setStep(1)} disabled={!audioFile}>
                Next <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card className="border-border/50 bg-card/60">
            <CardHeader>
              <CardTitle>Mode & Style</CardTitle>
              <CardDescription>Choose how your video will look</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="story">Story — Narrative arc with characters</SelectItem>
                    <SelectItem value="performance">Performance — Live performance style</SelectItem>
                    <SelectItem value="abstract">Abstract — Visual art, no narrative</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Style Preset</Label>
                <StylePresetPicker value={style} onChange={setStyle} />
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setStep(0)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
                <Button variant="hero" className="flex-1" onClick={() => setStep(2)}>
                  Next <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="border-border/50 bg-card/60">
            <CardHeader>
              <CardTitle>Confirm & Generate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl bg-secondary/50 p-4 space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Audio</span><span>{audioFile?.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Mode</span><span className="capitalize">{mode}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Style</span><span className="capitalize">{style}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Est. Shots</span><span>~{estimatedShots}</span></div>
                <div className="flex justify-between border-t border-border pt-2 font-medium">
                  <span className="flex items-center gap-1"><Coins className="h-4 w-4 text-primary" /> Estimated Cost</span>
                  <span className="text-primary">{estimatedCredits} credits</span>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
                <Button variant="hero" className="flex-1" onClick={handleCreate} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Generate Clip
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
