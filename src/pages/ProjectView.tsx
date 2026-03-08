import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

  // ─── Supabase Realtime ────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`project-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "projects", filter: `id=eq.${id}` },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["project", id] });
          const newStatus = payload.new?.status;
          if (newStatus === "completed") {
            toast({ title: "Complete!", description: "Your video is ready" });
          } else if (newStatus === "failed") {
            toast({ title: "Pipeline failed", description: "Check project for details", variant: "destructive" });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shots", filter: `project_id=eq.${id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["shots", id] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "renders", filter: `project_id=eq.${id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["render", id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

      // Fire the worker — realtime will handle UI updates
      await callEdgeFunction("pipeline-worker", { project_id: project.id });
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
  const completedShots = shots?.filter(s => s.status === "completed").length || 0;
  const totalShots = shots?.length || 0;

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
              <Badge variant={project.status === "failed" ? "destructive" : "secondary"} className="capitalize">
                {project.status}
              </Badge>
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

        <PipelineProgress status={project.status} completedShots={completedShots} totalShots={totalShots} />

        {shots && shots.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">
              Shots ({completedShots}/{totalShots} completed)
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
