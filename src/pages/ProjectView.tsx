import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { PipelineProgress } from "@/components/PipelineProgress";
import { ShotGrid } from "@/components/ShotGrid";
import { ShotPreviewPlayer } from "@/components/ShotPreviewPlayer";
import { RenderExportPanel } from "@/components/RenderExportPanel";
import { ProjectDiagnostics } from "@/components/ProjectDiagnostics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Play, Film, RefreshCw, Music, Palette, List, Share2, Eye, ArrowLeft, Clock, Clapperboard, Info, Wand2, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePageTitle } from "@/hooks/usePageTitle";

const statusLabels: Record<string, string> = {
  draft: "Brouillon", analyzing: "Analyse…", planning: "Planification…",
  generating: "Génération…", stitching: "Assemblage…", completed: "Terminé",
  failed: "Échoué", cancelled: "Annulé",
};
const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline", analyzing: "secondary", planning: "secondary",
  generating: "secondary", stitching: "secondary", completed: "default",
  failed: "destructive", cancelled: "outline",
};
const typeLabels: Record<string, string> = { clip: "Clip vidéo", film: "Court-métrage" };
const styleLabels: Record<string, string> = {
  cinematic: "Cinématique", anime: "Anime", watercolor: "Aquarelle",
  "3d_render": "Rendu 3D", noir: "Noir", vintage: "Vintage", neon: "Néon", realistic: "Réaliste",
  hyperpop: "Hyperpop", afrofuturism: "Afrofuturisme", synthwave: "Synthwave",
  documentary: "Documentaire", fantasy: "Fantaisie",
};
const modeLabels: Record<string, string> = {
  story: "Narratif", performance: "Performance", abstract: "Abstrait",
};
const styleBibleKeyLabels: Record<string, string> = {
  visual_rules: "Règles visuelles", regles_visuelles: "Règles visuelles",
  palette: "Palette de couleurs", camera_rules: "Règles caméra", regles_camera: "Règles caméra",
  lighting: "Éclairage", eclairage: "Éclairage", mood: "Ambiance", ambiance: "Ambiance",
  texture_guidelines: "Directives texture", directives_texture: "Directives texture",
};
export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [enriching, setEnriching] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  usePageTitle(project?.title ? `${project.title} — Projet` : "Projet");

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

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`project-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "projects", filter: `id=eq.${id}` }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ["project", id] });
        const newStatus = payload.new?.status;
        if (newStatus === "completed") toast({ title: "🎉 Terminé !", description: "Votre vidéo est prête à télécharger !" });
        else if (newStatus === "failed") toast({ title: "Pipeline échoué", description: "Vérifiez les détails du projet", variant: "destructive" });
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
      toast({ title: "Pipeline lancé", description: "Traitement de votre projet en cours…" });
      await callEdgeFunction("pipeline-worker", { project_id: project.id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Une erreur inattendue s'est produite";
      toast({ title: "Erreur du pipeline", description: message, variant: "destructive" });
      await supabase.from("projects").update({ status: "failed" as const }).eq("id", project.id);
    } finally {
      setPipelineRunning(false);
    }
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/share/${id}`;
    navigator.clipboard.writeText(shareUrl);
    toast({ title: "Lien copié !", description: "Le lien de partage a été copié dans le presse-papier" });
  };

  const handleEnrichSynopsis = async () => {
    if (!project || !session || enriching) return;
    setEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke("enhance-synopsis", {
        body: { project_id: project.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.synopsis) {
        queryClient.invalidateQueries({ queryKey: ["project", id] });
        toast({
          title: "✨ Synopsis enrichi",
          description: data.changes_summary || "Le synopsis a été amélioré par l'IA.",
        });
      }
    } catch (err: unknown) {
      console.error("[enhance-synopsis]", err);
      const message = err instanceof Error ? err.message : "Une erreur inattendue s'est produite";
      toast({ title: "Erreur IA", description: message, variant: "destructive" });
    } finally {
      setEnriching(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Chargement du projet…</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center py-32 text-muted-foreground gap-4">
          <Film className="h-16 w-16 opacity-30" />
          <p className="text-lg font-medium">Projet introuvable</p>
          <Button variant="outline" onClick={() => navigate("/dashboard")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Retour au tableau de bord
          </Button>
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
      <main className="container mx-auto max-w-5xl px-4 py-8 md:py-12">
        {/* Breadcrumb */}
        <button
          onClick={() => navigate("/dashboard")}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" /> Retour au tableau de bord
        </button>

        {/* Project Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-3 min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold truncate">{project.title}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={statusVariants[project.status] || "secondary"}>
                  {isActive && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                  {statusLabels[project.status] || project.status}
                </Badge>
                <Badge variant="outline">{typeLabels[project.type] || project.type}</Badge>
                {project.style_preset && (
                  <Badge variant="outline" className="text-muted-foreground">
                    {styleLabels[project.style_preset] || project.style_preset}
                  </Badge>
                )}
                {project.mode && (
                  <Badge variant="outline" className="text-muted-foreground">
                    {modeLabels[project.mode] || project.mode}
                  </Badge>
                )}
              </div>
              {project.synopsis && (
                <div className="flex items-start gap-2 max-w-2xl">
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1">{project.synopsis}</p>
                  {session && (project.status === "draft" || project.status === "completed") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleEnrichSynopsis}
                      disabled={enriching}
                      className="shrink-0 gap-1.5 text-xs h-7"
                      title="Enrichir le synopsis avec l'IA"
                    >
                      {enriching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                      {enriching ? "Enrichissement…" : "Enrichir"}
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 shrink-0">
              {project.status === "completed" && (
                <Button variant="glass" size="sm" onClick={handleShare} className="gap-2">
                  <Share2 className="h-4 w-4" /> Partager
                </Button>
              )}
              {project.status === "draft" && (
                <Button variant="hero" onClick={startPipeline} disabled={pipelineRunning} className="gap-2">
                  {pipelineRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {pipelineRunning ? "En cours…" : "Lancer le pipeline"}
                </Button>
              )}
              {project.status === "failed" && (
                <Button variant="hero" onClick={startPipeline} disabled={pipelineRunning} className="gap-2">
                  <RefreshCw className="h-4 w-4" /> Réessayer
                </Button>
              )}
            </div>
          </div>

          {/* Quick Info Bar */}
          {(project.duration_sec || project.aspect_ratio || project.provider_default) && (
            <div className="mt-4 flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
              {project.duration_sec && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {Math.floor(project.duration_sec / 60)} min {project.duration_sec % 60 > 0 ? `${project.duration_sec % 60}s` : ""}
                </span>
              )}
              {project.aspect_ratio && (
                <span className="flex items-center gap-1">
                  <Clapperboard className="h-3.5 w-3.5" /> {project.aspect_ratio}
                </span>
              )}
              {project.provider_default && (
                <span className="flex items-center gap-1 capitalize">
                  <Info className="h-3.5 w-3.5" /> {project.provider_default}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Pipeline Progress */}
        <div className="mb-8">
          <PipelineProgress projectId={project.id} status={project.status} completedShots={completedShots} totalShots={totalShots} />
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue={hasCompletedShots ? "preview" : "shots"} className="space-y-6">
          <TabsList className="h-auto flex-wrap gap-1 bg-secondary/40 p-1.5 rounded-xl">
            {hasCompletedShots && (
              <TabsTrigger value="preview" className="gap-1.5 text-xs sm:text-sm rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Eye className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Aperçu</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="shots" className="gap-1.5 text-xs sm:text-sm rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Clapperboard className="h-3.5 w-3.5" />
              <span>Plans</span>
              {totalShots > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{completedShots}/{totalShots}</Badge>}
            </TabsTrigger>
            {plan && (
              <TabsTrigger value="plan" className="gap-1.5 text-xs sm:text-sm rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Palette className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Plan</span>
              </TabsTrigger>
            )}
            {audioAnalysis && (
              <TabsTrigger value="audio" className="gap-1.5 text-xs sm:text-sm rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Music className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Audio</span>
              </TabsTrigger>
            )}
            {(render || project.status === "completed") && (
              <TabsTrigger value="render" className="gap-1.5 text-xs sm:text-sm rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Film className="h-3.5 w-3.5" />
                <span>Export</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="diagnostics" className="gap-1.5 text-xs sm:text-sm rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Activity className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Diagnostic</span>
            </TabsTrigger>
          </TabsList>

          {/* Preview Tab */}
          {hasCompletedShots && (
            <TabsContent value="preview" forceMount className="data-[state=inactive]:hidden">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}>
                <ShotPreviewPlayer shots={shots || []} audioUrl={project.audio_url} bpm={audioAnalysis?.bpm} />
              </motion.div>
            </TabsContent>
          )}

          {/* Shots Tab */}
          <TabsContent value="shots" forceMount className="data-[state=inactive]:hidden">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}>
              {shots && shots.length > 0 ? (
                <ShotGrid shots={shots} />
              ) : (
                <Card className="border-border/50 bg-card/40">
                  <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <Clapperboard className="h-12 w-12 text-muted-foreground/30" />
                    <p className="text-muted-foreground font-medium">Aucun plan généré</p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      Les plans seront créés automatiquement lors de l'étape de génération du pipeline.
                    </p>
                    {project.status === "draft" && (
                      <Button variant="hero" size="sm" onClick={startPipeline} disabled={pipelineRunning} className="mt-2 gap-2">
                        <Play className="h-4 w-4" /> Lancer le pipeline
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </TabsContent>

          {/* Plan Tab */}
          {plan && (
            <TabsContent value="plan" forceMount className="space-y-6 data-[state=inactive]:hidden">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} className="space-y-6">
              {styleBible && Object.keys(styleBible).length > 0 && (
                <Card className="border-border/50 bg-card/60">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Palette className="h-4 w-4 text-primary" /> Bible de style
                    </CardTitle>
                    <CardDescription className="text-sm">
                      Directives visuelles générées par l'IA pour assurer la cohérence de chaque plan.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.entries(styleBible).map(([key, val], i) => (
                        <motion.div
                          key={key}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25, delay: i * 0.05 }}
                          className="rounded-lg bg-secondary/30 p-4"
                        >
                          <span className="text-xs font-semibold text-primary uppercase tracking-wider">{styleBibleKeyLabels[key] || key.replace(/_/g, " ")}</span>
                          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                            {typeof val === "string" ? val : JSON.stringify(val)}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {shotlistJson && shotlistJson.length > 0 && (
                <Card className="border-border/50 bg-card/60">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <List className="h-4 w-4 text-primary" /> Liste des plans
                      <Badge variant="secondary" className="text-xs">{shotlistJson.length}</Badge>
                    </CardTitle>
                    <CardDescription className="text-sm">
                      Découpage scène par scène prévu par le réalisateur IA.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                      {shotlistJson.map((shot: any, i: number) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: i * 0.03 }}
                          className="flex items-start gap-4 rounded-lg bg-secondary/30 p-4 hover:bg-secondary/40 transition-colors"
                        >
                          <span className="text-sm font-bold text-primary shrink-0 w-8 text-right">#{i + 1}</span>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {shot.prompt || shot.description || JSON.stringify(shot)}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              </motion.div>
            </TabsContent>
          )}

          {/* Audio Tab */}
          {audioAnalysis && (
            <TabsContent value="audio" forceMount className="data-[state=inactive]:hidden">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}>
              <Card className="border-border/50 bg-card/60">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Music className="h-4 w-4 text-primary" /> Analyse audio
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Résultats de l'analyse de votre piste audio : tempo, énergie et structure.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {audioAnalysis.bpm && (
                    <div className="flex items-center gap-6 p-4 rounded-xl bg-secondary/30">
                      <div>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">BPM</span>
                        <p className="text-3xl font-bold text-primary mt-1">{Math.round(audioAnalysis.bpm)}</p>
                      </div>
                      <div className="h-12 w-px bg-border" />
                      <div>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tempo</span>
                        <p className="text-sm text-foreground mt-1">
                          {audioAnalysis.bpm < 90 ? "Lent" : audioAnalysis.bpm < 120 ? "Modéré" : audioAnalysis.bpm < 150 ? "Rapide" : "Très rapide"}
                        </p>
                      </div>
                    </div>
                  )}
                  {sectionsJson && sectionsJson.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3">Structure du morceau</h4>
                      <div className="flex gap-2 flex-wrap">
                        {sectionsJson.map((sec: any, i: number) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.2, delay: i * 0.04 }}
                          >
                            <Badge variant="outline" className="text-xs py-1.5 px-3">
                              {sec.label || sec.type || `Section ${i + 1}`}
                              {sec.start != null && (
                                <span className="ml-1.5 text-muted-foreground">
                                  {Math.floor(sec.start / 60)}:{String(Math.round(sec.start % 60)).padStart(2, "0")}
                                </span>
                              )}
                            </Badge>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              </motion.div>
            </TabsContent>
          )}

          {/* Export Tab */}
          {(render || project.status === "completed") && (
            <TabsContent value="render" forceMount className="data-[state=inactive]:hidden">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}>
                <RenderExportPanel projectId={project.id} render={render} projectStatus={project.status} />
              </motion.div>
            </TabsContent>
          )}

          {/* Diagnostics Tab */}
          <TabsContent value="diagnostics" forceMount className="data-[state=inactive]:hidden">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}>
              <ProjectDiagnostics project={project} shots={shots || null} render={render || null} plan={plan || null} audioAnalysis={audioAnalysis || null} />
            </motion.div>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}
