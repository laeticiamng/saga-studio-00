import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { PipelineProgress } from "@/components/PipelineProgress";
import { ShotGrid } from "@/components/ShotGrid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Download, Film, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useCallback } from "react";

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const { toast } = useToast();
  const [pipelineRunning, setPipelineRunning] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    refetchInterval: 3000,
  });

  const { data: shots } = useQuery({
    queryKey: ["shots", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("shots").select("*").eq("project_id", id!).order("idx");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    refetchInterval: 3000,
  });

  const { data: render } = useQuery({
    queryKey: ["render", id],
    queryFn: async () => {
      const { data } = await supabase.from("renders").select("*").eq("project_id", id!).maybeSingle();
      return data;
    },
    enabled: !!id,
    refetchInterval: 3000,
  });

  const callEdgeFunction = useCallback(async (name: string, body: any) => {
    const res = await supabase.functions.invoke(name, { body });
    if (res.error) throw res.error;
    return res.data;
  }, []);

  const startPipeline = async () => {
    if (!project || !session) return;
    setPipelineRunning(true);
    try {
      // Step 1: Set to analyzing
      await supabase.from("projects").update({ status: "analyzing" as const }).eq("id", project.id);
      
      // Step 2: Analyze audio
      toast({ title: "Pipeline started", description: "Analyzing audio..." });
      await callEdgeFunction("analyze-audio", { project_id: project.id });
      
      // Step 3: Plan project
      toast({ title: "Planning", description: "Generating shotlist with AI..." });
      await callEdgeFunction("plan-project", { project_id: project.id });
      
      // Step 4: Generate shots
      toast({ title: "Generating", description: "Creating shots..." });
      await callEdgeFunction("generate-shots", { project_id: project.id, batch_size: 50 });
      
      // Step 5: Stitch
      toast({ title: "Stitching", description: "Assembling final video..." });
      await callEdgeFunction("stitch-render", { project_id: project.id });
      
      toast({ title: "Complete!", description: "Your video is ready" });
    } catch (err: any) {
      toast({ title: "Pipeline Error", description: err.message, variant: "destructive" });
      await supabase.from("projects").update({ status: "failed" as const }).eq("id", project.id);
    } finally {
      setPipelineRunning(false);
    }
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{project.title}</h1>
            <div className="mt-2 flex items-center gap-3">
              <Badge variant="outline">{project.type}</Badge>
              <Badge variant="secondary" className="capitalize">{project.style_preset}</Badge>
              <Badge variant="secondary">{project.status}</Badge>
              {project.mode && <Badge variant="outline" className="capitalize">{project.mode}</Badge>}
            </div>
            {project.synopsis && (
              <p className="mt-3 text-sm text-muted-foreground max-w-2xl">{project.synopsis}</p>
            )}
          </div>
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

        <PipelineProgress status={project.status} />

        {shots && shots.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">
              Shots ({shots.filter(s => s.status === "completed").length}/{shots.length} completed)
            </h2>
            <ShotGrid shots={shots} />
          </div>
        )}

        {render && render.status === "completed" && (
          <Card className="mt-8 border-primary/30 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" /> Final Renders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {render.master_url_16_9 && (
                <a href={render.master_url_16_9} target="_blank" rel="noopener noreferrer">
                  <Button variant="glass" className="w-full justify-start gap-2">
                    <Download className="h-4 w-4" /> Download 16:9 Master
                  </Button>
                </a>
              )}
              {render.master_url_9_16 && (
                <a href={render.master_url_9_16} target="_blank" rel="noopener noreferrer">
                  <Button variant="glass" className="w-full justify-start gap-2 mt-2">
                    <Download className="h-4 w-4" /> Download 9:16 Vertical
                  </Button>
                </a>
              )}
              {render.teaser_url && (
                <a href={render.teaser_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="glass" className="w-full justify-start gap-2 mt-2">
                    <Download className="h-4 w-4" /> Download 15s Teaser
                  </Button>
                </a>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
