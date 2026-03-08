import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import StylePresetPicker from "@/components/StylePresetPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Film, Coins, Loader2, Cpu } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CreateFilm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [duration, setDuration] = useState("120");
  const [style, setStyle] = useState("cinematic");
  const [provider, setProvider] = useState("auto");
  const [loading, setLoading] = useState(false);

  const durationSec = parseInt(duration);
  const estimatedShots = Math.ceil(durationSec / 7);
  const estimatedCredits = 10 + estimatedShots * 2;

  const handleCreate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: project, error } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          type: "film" as const,
          title,
          synopsis,
          style_preset: style,
          duration_sec: durationSec,
          mode: "story",
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
        <h1 className="text-3xl font-bold mb-2">Generate a Film</h1>
        <p className="text-muted-foreground mb-8">Describe your story and AI will bring it to life</p>

        <Card className="border-border/50 bg-card/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Film className="h-5 w-5 text-primary" /> Film Details</CardTitle>
            <CardDescription>Tell us about your short film</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The Last Signal" required />
            </div>
            <div className="space-y-2">
              <Label>Synopsis (5-8 lines)</Label>
              <Textarea value={synopsis} onChange={(e) => setSynopsis(e.target.value)} placeholder="In a world where..." rows={6} required />
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
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

            <div className="rounded-xl bg-secondary/50 p-4 space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Est. Shots</span><span>~{estimatedShots}</span></div>
              <div className="flex justify-between font-medium">
                <span className="flex items-center gap-1"><Coins className="h-4 w-4 text-primary" /> Estimated Cost</span>
                <span className="text-primary">{estimatedCredits} credits</span>
              </div>
            </div>

            <Button variant="hero" className="w-full" onClick={handleCreate} disabled={loading || !title || !synopsis}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Generate Film
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
