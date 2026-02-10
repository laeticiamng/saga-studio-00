import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { PipelineProgress } from "@/components/PipelineProgress";
import { ShotGrid } from "@/components/ShotGrid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Download, Film } from "lucide-react";

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    refetchInterval: 5000,
  });

  const { data: shots } = useQuery({
    queryKey: ["shots", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("shots").select("*").eq("project_id", id!).order("idx");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    refetchInterval: 5000,
  });

  const { data: render } = useQuery({
    queryKey: ["render", id],
    queryFn: async () => {
      const { data } = await supabase.from("renders").select("*").eq("project_id", id!).maybeSingle();
      return data;
    },
    enabled: !!id,
    refetchInterval: 5000,
  });

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

  const startPipeline = async () => {
    await supabase.from("projects").update({ status: "analyzing" as const }).eq("id", project.id);
  };

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
            </div>
          </div>
          {project.status === "draft" && (
            <Button variant="hero" onClick={startPipeline} className="gap-2">
              <Play className="h-4 w-4" /> Start Pipeline
            </Button>
          )}
        </div>

        <PipelineProgress status={project.status} />

        {shots && shots.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Shots ({shots.length})</h2>
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
                  <Button variant="glass" className="w-full justify-start gap-2">
                    <Download className="h-4 w-4" /> Download 9:16 Vertical
                  </Button>
                </a>
              )}
              {render.teaser_url && (
                <a href={render.teaser_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="glass" className="w-full justify-start gap-2">
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
