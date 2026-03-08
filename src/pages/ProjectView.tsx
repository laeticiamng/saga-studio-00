import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { PipelineProgress } from "@/components/PipelineProgress";
import { ShotGrid } from "@/components/ShotGrid";
import { ShotPreviewPlayer } from "@/components/ShotPreviewPlayer";
import { RenderExportPanel } from "@/components/RenderExportPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Play, Film, RefreshCw, Music, Palette, List, Share2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useCallback, useEffect } from "react";

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pipelineRunning, setPipelineRunning] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: shots } = useQuery({
    queryKey: ["shots", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("shots").select("*").eq("project_id", id!).order("idx");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: render } = useQuery({
    queryKey: ["render", id],
    queryFn: async () => {
      const { data } = await supabase.from("renders").select("*").eq("project_id", id!).maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: plan } = useQuery({
    queryKey: ["plan", id],
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("*").eq("project_id", id!).order("version", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: audioAnalysis } = useQuery({
    queryKey: ["audio-analysis", id],
    queryFn: async () => {
      const { data } = await supabase.from("audio_analysis").select("*").eq("project_id", id!).maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  // Realtime subscriptions
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`project-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "projects", filter: `id=eq.${id}` }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ["project", id] });
        const newStatus = payload.new?.status;
        if (newStatus === "completed") toast({ title: "🎉 Complete!", description: "Your video is ready to download!" });
        else if (newStatus === "failed") toast({ title: "Pipeline failed", description: "Check project for details", variant: "destructive" });
        queryClient.invalidateQueries({ queryKey: ["plan", id] });
        queryClient.invalidateQueries({ queryKey: ["audio-analysis", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "shots", filter: `project_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["shots", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "renders", filter: `project_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["render", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "plans", filter: `project_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["plan", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "audio_analysis", filter: `project_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["audio-analysis", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, queryClient, toast]);

  const callEdgeFunction = useCallback(async (name: string, body: any) => {
    const res = await supabase.functions.invoke(name, { body });
    if (res.error) throw res.error;
    return res.data;
  }, []);

  const startPipeline = async () => {
    if (!project || !session) return;
    setPipelineRunning(true);
    try {
      await supabase.from("projects").update({ status: "analyzing" as const }).eq("id", project.id);
      toast({ title: "Pipeline started", description: "Processing your project..." });
      await callEdgeFunction("pipeline-worker", { project_id: project.id });
    } catch (err: any) {
      toast({ title: "Pipeline Error", description: err.message, variant: "destructive" });
      await supabase.from("projects").update({ status: "failed" as const }).eq("id", project.id);
    } finally {
      setPipelineRunning(false);
    }
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/share/${id}`;
    navigator.clipboard.writeText(shareUrl);
    toast({ title: "Link copied!", description: "Share link copied to clipboard" });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center py-20 text-muted-foreground">
          <Film className="h-16 w-16 mb-4" />
          <p>Project not found</p>
        </div>
      </div>
    );
  }

  const isActive = ["analyzing", "planning", "generating", "stitching"].includes(project.status);
  const completedShots = shots?.filter(s => s.status === "completed").length || 0;
  const totalShots = shots?.length || 0;
  const shotlistJson = plan?.shotlist_json as any[] | null;
  const styleBible = plan?.style_bible_json as Record<string, any> | null;
  const sectionsJson = audioAnalysis?.sections_json as any[] | null;
  const hasCompletedShots = completedShots > 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{project.title}</h1>
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              <Badge variant="outline">{project.type}</Badge>
              <Badge variant="secondary" className="capitalize">{project.style_preset}</Badge>
              <Badge variant={project.status === "failed" ? "destructive" : "secondary"} className="capitalize">{project.status}</Badge>
              {project.mode && <Badge variant="outline" className="capitalize">{project.mode}</Badge>}
              {project.provider_default && <Badge variant="outline" className="capitalize">{project.provider_default}</Badge>}
            </div>
            {project.synopsis && <p className="mt-3 text-sm text-muted-foreground max-w-2xl">{project.synopsis}</p>}
          </div>
          <div className="flex gap-2">
            {project.status === "completed" && (
              <Button variant="glass" size="sm" onClick={handleShare} className="gap-2">
                <Share2 className="h-4 w-4" /> Share
              </Button>
            )}
            {project.status === "draft" && (
              <Button variant="hero" onClick={startPipeline} disabled={pipelineRunning} className="gap-2">
                {pipelineRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {pipelineRunning ? "Running..." : "Start Pipeline"}
              </Button>
            )}
            {project.status === "failed" && (
              <Button variant="hero" onClick={startPipeline} disabled={pipelineRunning} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Retry Pipeline
              </Button>
            )}
          </div>
        </div>

        <PipelineProgress status={project.status} completedShots={completedShots} totalShots={totalShots} />

        <Tabs defaultValue={hasCompletedShots ? "preview" : "shots"} className="mt-8">
          <TabsList>
            {hasCompletedShots && <TabsTrigger value="preview"><Eye className="h-3.5 w-3.5 mr-1.5" />Preview</TabsTrigger>}
            <TabsTrigger value="shots">Shots ({totalShots})</TabsTrigger>
            {plan && <TabsTrigger value="plan">Plan</TabsTrigger>}
            {audioAnalysis && <TabsTrigger value="audio">Audio</TabsTrigger>}
            {(render || project.status === "completed") && <TabsTrigger value="render">Export</TabsTrigger>}
          </TabsList>

          {/* Preview Tab */}
          {hasCompletedShots && (
            <TabsContent value="preview" className="mt-4">
              <ShotPreviewPlayer
                shots={shots || []}
                audioUrl={project.audio_url}
                bpm={audioAnalysis?.bpm}
              />
            </TabsContent>
          )}

          {/* Shots Tab */}
          <TabsContent value="shots" className="mt-4">
            {shots && shots.length > 0 ? (
              <ShotGrid shots={shots} />
            ) : (
              <p className="text-muted-foreground text-sm py-8 text-center">No shots generated yet. Start the pipeline to begin.</p>
            )}
          </TabsContent>

          {/* Plan Tab */}
          {plan && (
            <TabsContent value="plan" className="mt-4 space-y-4">
              {styleBible && Object.keys(styleBible).length > 0 && (
                <Card className="border-border/50 bg-card/60">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><Palette className="h-4 w-4 text-primary" /> Style Bible</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(styleBible).map(([key, val]) => (
                        <div key={key} className="rounded-lg bg-secondary/30 p-3">
                          <span className="text-xs font-medium text-primary capitalize">{key.replace(/_/g, " ")}</span>
                          <p className="text-xs text-muted-foreground mt-0.5">{typeof val === "string" ? val : JSON.stringify(val)}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {shotlistJson && shotlistJson.length > 0 && (
                <Card className="border-border/50 bg-card/60">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><List className="h-4 w-4 text-primary" /> Shot List ({shotlistJson.length} shots)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-96 overflow-auto">
                      {shotlistJson.map((shot: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 rounded-lg bg-secondary/30 p-3">
                          <span className="text-xs font-bold text-primary shrink-0">#{i + 1}</span>
                          <p className="text-xs text-muted-foreground">{shot.prompt || shot.description || JSON.stringify(shot)}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}

          {/* Audio Tab */}
          {audioAnalysis && (
            <TabsContent value="audio" className="mt-4">
              <Card className="border-border/50 bg-card/60">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><Music className="h-4 w-4 text-primary" /> Audio Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {audioAnalysis.bpm && (
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">BPM</span>
                      <span className="text-2xl font-bold text-primary">{Math.round(audioAnalysis.bpm)}</span>
                    </div>
                  )}
                  {sectionsJson && sectionsJson.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Sections</h4>
                      <div className="flex gap-2 flex-wrap">
                        {sectionsJson.map((sec: any, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {sec.label || sec.type || `Section ${i + 1}`}
                            {sec.start != null && ` (${Math.round(sec.start)}s)`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Export Tab (replaces old Render tab) */}
          {(render || project.status === "completed") && (
            <TabsContent value="render" className="mt-4">
              <RenderExportPanel
                projectId={project.id}
                render={render}
                projectStatus={project.status}
              />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
