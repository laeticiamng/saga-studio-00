import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTimelines, useCreateTimeline } from "@/hooks/useTimelines";
import { useTimelineTracks } from "@/hooks/useTimelineTracks";
import { useTimelineClips, useUpdateClip } from "@/hooks/useTimelineClips";
import { useReviewGates, useDecideReviewGate } from "@/hooks/useReviewGates";
import { useExportVersions, useCreateExportVersion } from "@/hooks/useExportVersions";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useToast } from "@/hooks/use-toast";
import { TimelineView } from "@/components/studio/TimelineView";
import { ReviewGatesPanel } from "@/components/studio/ReviewGatesPanel";
import { FinishingPanel } from "@/components/studio/FinishingPanel";
import { ExportPanel } from "@/components/studio/ExportPanel";
import { DiagnosticsPanel } from "@/components/studio/DiagnosticsPanel";
import { CostEstimationCard } from "@/components/studio/CostEstimationCard";
import {
  Loader2, Film, Layers, Play, CheckCircle, Lock, Unlock,
  Plus, Download, Palette, Shield, Eye, Activity, DollarSign,
} from "lucide-react";

export default function TimelineStudio() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  usePageTitle(project?.title ? `Studio — ${project.title}` : "Studio Timeline");

  const { data: timelines, isLoading: timelinesLoading } = useTimelines(id);
  const [selectedTimelineId, setSelectedTimelineId] = useState<string | null>(null);
  const createTimeline = useCreateTimeline();

  // Auto-select first timeline
  useEffect(() => {
    if (timelines?.length && !selectedTimelineId) {
      setSelectedTimelineId(timelines[0].id);
    }
  }, [timelines, selectedTimelineId]);

  const activeTimeline = timelines?.find(t => t.id === selectedTimelineId);
  const { data: tracks } = useTimelineTracks(selectedTimelineId || undefined);
  const trackIds = useMemo(() => tracks?.map(t => t.id) || [], [tracks]);
  const { data: clips } = useTimelineClips(trackIds);
  const { data: gates } = useReviewGates(id);
  const { data: exports } = useExportVersions(id);

  // Realtime
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`studio-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "timelines", filter: `project_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["timelines", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "timeline_clips" }, () => {
        qc.invalidateQueries({ queryKey: ["timeline_clips"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "review_gates", filter: `project_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["review_gates", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "export_versions", filter: `project_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["export_versions", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, qc]);

  const handleCreateTimeline = async (name: string) => {
    if (!id) return;
    const nextVersion = (timelines?.length ?? 0) + 1;
    try {
      const tl = await createTimeline.mutateAsync({
        project_id: id,
        name,
        version: nextVersion,
      });
      setSelectedTimelineId(tl.id);
      toast({ title: `Timeline "${name}" créée` });
    } catch (err: unknown) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Erreur", variant: "destructive" });
    }
  };

  if (projectLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Projet introuvable</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container max-w-7xl py-6 px-4">
        <Breadcrumbs items={[
          { label: "Mes projets", href: "/dashboard" },
          { label: project.title, href: `/project/${id}` },
          { label: "Studio" },
        ]} />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Film className="h-6 w-6 text-primary" />
              Studio — {project.title}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Timeline selector */}
            {timelines && timelines.length > 0 && (
              <Select value={selectedTimelineId || ""} onValueChange={setSelectedTimelineId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Sélectionner timeline" />
                </SelectTrigger>
                <SelectContent>
                  {timelines.map((tl) => (
                    <SelectItem key={tl.id} value={tl.id}>
                      v{tl.version} — {tl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCreateTimeline(
                timelines?.length ? "Fine Cut" : "Rough Cut"
              )}
              disabled={createTimeline.isPending}
            >
              <Plus className="h-4 w-4 mr-1" />
              {timelines?.length ? "Nouvelle version" : "Créer timeline"}
            </Button>
          </div>
        </div>

        {!activeTimeline ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <Layers className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Aucune timeline</h3>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                Créez une timeline pour commencer l'assemblage de votre projet.
                La première sera votre "Rough Cut".
              </p>
              <Button onClick={() => handleCreateTimeline("Rough Cut")}>
                <Plus className="h-4 w-4 mr-2" /> Créer le Rough Cut
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
            <Tabs defaultValue="timeline" className="space-y-4">
              <TabsList className="bg-secondary/40 p-1 rounded-xl flex-wrap">
                <TabsTrigger value="timeline" className="gap-1.5 rounded-lg">
                  <Layers className="h-4 w-4" /> Timeline
                </TabsTrigger>
                <TabsTrigger value="gates" className="gap-1.5 rounded-lg">
                  <Shield className="h-4 w-4" /> Validations
                  {gates?.filter(g => g.status === "pending").length ? (
                    <Badge variant="destructive" className="ml-1 text-[10px] px-1.5">
                      {gates.filter(g => g.status === "pending").length}
                    </Badge>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="finishing" className="gap-1.5 rounded-lg">
                  <Palette className="h-4 w-4" /> Finishing
                </TabsTrigger>
                <TabsTrigger value="exports" className="gap-1.5 rounded-lg">
                  <Download className="h-4 w-4" /> Export
                  {exports?.length ? (
                    <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">
                      {exports.length}
                    </Badge>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="diagnostics" className="gap-1.5 rounded-lg">
                  <Activity className="h-4 w-4" /> Diagnostics
                </TabsTrigger>
              </TabsList>

              <TabsContent value="timeline">
                <TimelineView
                  timeline={activeTimeline}
                  tracks={tracks || []}
                  clips={clips || []}
                  projectId={id!}
                />
              </TabsContent>

              <TabsContent value="gates">
                <ReviewGatesPanel
                  projectId={id!}
                  gates={gates || []}
                />
              </TabsContent>

              <TabsContent value="finishing">
                <FinishingPanel
                  timeline={activeTimeline}
                  projectId={id!}
                />
              </TabsContent>

              <TabsContent value="exports">
                <ExportPanel
                  projectId={id!}
                  exports={exports || []}
                  timelineId={selectedTimelineId}
                />
              </TabsContent>

              <TabsContent value="diagnostics">
                <DiagnosticsPanel projectId={id!} />
              </TabsContent>
            </Tabs>

            {/* Right sidebar — cost governance */}
            <div className="space-y-4 hidden lg:block">
              <CostEstimationCard projectId={id!} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
