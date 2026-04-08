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
import { useReviewGates } from "@/hooks/useReviewGates";
import { useExportVersions } from "@/hooks/useExportVersions";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useToast } from "@/hooks/use-toast";
import { TimelineView } from "@/components/studio/TimelineView";
import { ReviewGatesPanel } from "@/components/studio/ReviewGatesPanel";
import { FinishingPanel } from "@/components/studio/FinishingPanel";
import { ExportPanel } from "@/components/studio/ExportPanel";
import { DiagnosticsPanel } from "@/components/studio/DiagnosticsPanel";
import { CostEstimationCard } from "@/components/studio/CostEstimationCard";
import { ProjectValidationPanel } from "@/components/studio/ProjectValidationPanel";
import { ClipPreviewDrawer } from "@/components/studio/ClipPreviewDrawer";
import { ShotPreviewPlayer } from "@/components/ShotPreviewPlayer";
import {
  Loader2, Film, Layers, Play, Plus, Download, Palette, Shield, Activity, DollarSign, Wand2, ShieldCheck, Monitor,
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

  // Fetch project shots for Program Monitor
  const { data: projectShots } = useQuery({
    queryKey: ["project_shots_studio", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shots")
        .select("id, idx, status, output_url, duration_sec, prompt")
        .eq("project_id", id!)
        .order("idx");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch audio analysis for BPM display
  const { data: audioAnalysis } = useQuery({
    queryKey: ["audio_analysis_studio", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("audio_analysis")
        .select("bpm")
        .eq("project_id", id!)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

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

  // Clip preview drawer
  const [drawerClip, setDrawerClip] = useState<Record<string, unknown> | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleClipSelect = (clip: Record<string, unknown>) => {
    setDrawerClip(clip);
    setDrawerOpen(true);
  };

  // Realtime subscriptions
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
      // Progressive shot display — shots completing during generation
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "shots", filter: `project_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["project_shots_studio", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, qc]);

  const handleCreateTimeline = async (name: string) => {
    if (!id) return;
    const nextVersion = (timelines?.length ?? 0) + 1;
    try {
      const tl = await createTimeline.mutateAsync({ project_id: id, name, version: nextVersion });
      setSelectedTimelineId(tl.id);
      toast({ title: `Timeline "${name}" créée` });
    } catch (err: unknown) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Erreur", variant: "destructive" });
    }
  };

  const [assembling, setAssembling] = useState(false);
  const handleAssemble = async () => {
    if (!id) return;
    setAssembling(true);
    try {
      const { data, error } = await supabase.functions.invoke("assemble-rough-cut", {
        body: { project_id: id, timeline_id: selectedTimelineId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "✅ Assemblage terminé", description: `${data.clips_placed} clips placés` });
      qc.invalidateQueries({ queryKey: ["timelines", id] });
      qc.invalidateQueries({ queryKey: ["timeline_clips"] });
      qc.invalidateQueries({ queryKey: ["timeline_tracks"] });
      qc.invalidateQueries({ queryKey: ["review_gates", id] });
      if (data.timeline_id) setSelectedTimelineId(data.timeline_id);
    } catch (err: unknown) {
      toast({ title: "Erreur d'assemblage", description: err instanceof Error ? err.message : "Erreur", variant: "destructive" });
    } finally {
      setAssembling(false);
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

  const completedShots = (projectShots || []).filter(s => s.status === "completed" && s.output_url);
  const showMonitor = completedShots.length > 0;

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Film className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              <span className="truncate">Studio — {project.title}</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {timelines && timelines.length > 0 && (
              <Select value={selectedTimelineId || ""} onValueChange={setSelectedTimelineId}>
                <SelectTrigger className="w-[160px] sm:w-[200px]">
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
              onClick={() => handleCreateTimeline(timelines?.length ? "Fine Cut" : "Rough Cut")}
              disabled={createTimeline.isPending}
            >
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">{timelines?.length ? "Nouvelle version" : "Créer timeline"}</span>
              <span className="sm:hidden">+</span>
            </Button>
            <Button variant="default" size="sm" onClick={handleAssemble} disabled={assembling}>
              {assembling ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1" />}
              <span className="hidden sm:inline">Assembler</span>
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
              </p>
              <Button onClick={() => handleCreateTimeline("Rough Cut")}>
                <Plus className="h-4 w-4 mr-2" /> Créer le Rough Cut
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 overflow-x-hidden">
            <div className="space-y-4">
              {/* Program Monitor */}
              {showMonitor && (
                <Card className="overflow-hidden">
                  <CardHeader className="py-2 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-primary" />
                      Program Monitor
                      <Badge variant="secondary" className="text-[10px]">{completedShots.length} plans</Badge>
                      {audioAnalysis?.bpm && (
                        <Badge variant="outline" className="text-[10px]">♪ {Math.round(audioAnalysis.bpm)} BPM</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ShotPreviewPlayer
                      shots={completedShots}
                      audioUrl={project.audio_url}
                      bpm={audioAnalysis?.bpm}
                    />
                  </CardContent>
                </Card>
              )}

              <Tabs defaultValue="timeline" className="space-y-4">
                <TabsList className="bg-secondary/40 p-1 rounded-xl flex-wrap gap-1 overflow-x-auto">
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
                  <TabsTrigger value="validation" className="gap-1.5 rounded-lg">
                    <ShieldCheck className="h-4 w-4" /> Anti-Aberrations
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="timeline">
                  <TimelineView
                    timeline={activeTimeline}
                    tracks={tracks || []}
                    clips={clips || []}
                    projectId={id!}
                    onClipSelect={handleClipSelect}
                  />
                </TabsContent>

                <TabsContent value="gates">
                  <ReviewGatesPanel projectId={id!} gates={gates || []} />
                </TabsContent>

                <TabsContent value="finishing">
                  <FinishingPanel timeline={activeTimeline} projectId={id!} />
                </TabsContent>

                <TabsContent value="exports">
                  <ExportPanel projectId={id!} exports={exports || []} timelineId={selectedTimelineId} />
                </TabsContent>

                <TabsContent value="diagnostics">
                  <DiagnosticsPanel projectId={id!} />
                </TabsContent>

                <TabsContent value="validation">
                  <ProjectValidationPanel projectId={id!} />
                </TabsContent>
              </Tabs>
            </div>

            {/* Right sidebar */}
            <div className="space-y-4 hidden lg:block">
              <CostEstimationCard projectId={id!} />
            </div>
          </div>
        )}

        {/* Clip Preview Drawer */}
        <ClipPreviewDrawer clip={drawerClip} open={drawerOpen} onOpenChange={setDrawerOpen} />
      </main>
    </div>
  );
}
