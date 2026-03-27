import { useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";
import {
  Loader2, Shield, Activity, CreditCard, Film, Clapperboard, AlertTriangle,
  CheckCircle, Clock, XCircle, Ban, RotateCcw, CheckCheck, Eye, TrendingUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { statusLabels, typeLabels, styleLabels } from "@/lib/labels";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
    completed: { variant: "default", icon: <CheckCircle className="h-3 w-3" /> },
    processing: { variant: "secondary", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    pending: { variant: "outline", icon: <Clock className="h-3 w-3" /> },
    failed: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
    cancelled: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
    generating: { variant: "secondary", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    analyzing: { variant: "secondary", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    planning: { variant: "secondary", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    stitching: { variant: "secondary", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    draft: { variant: "outline", icon: <Clock className="h-3 w-3" /> },
    resolved: { variant: "default", icon: <CheckCheck className="h-3 w-3" /> },
    dismissed: { variant: "outline", icon: <XCircle className="h-3 w-3" /> },
    reviewed: { variant: "secondary", icon: <Eye className="h-3 w-3" /> },
  };
  const s = map[status] || { variant: "outline" as const, icon: null };
  return (
    <Badge variant={s.variant} className="gap-1 text-xs">
      {s.icon} {statusLabels[status] || status}
    </Badge>
  );
}

function groupByDay(items: { created_at: string; delta?: number }[], mode: "count" | "sum") {
  const map = new Map<string, number>();
  for (const item of items) {
    const day = new Date(item.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
    const prev = map.get(day) || 0;
    map.set(day, mode === "count" ? prev + 1 : prev + Math.abs(item.delta ?? 0));
  }
  return Array.from(map.entries()).map(([day, value]) => ({ day, value })).reverse();
}

function groupByWeek(items: { created_at: string }[]) {
  const map = new Map<string, number>();
  for (const item of items) {
    const d = new Date(item.created_at);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay() + 1);
    const label = `Sem. ${weekStart.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}`;
    map.set(label, (map.get(label) || 0) + 1);
  }
  return Array.from(map.entries()).map(([week, value]) => ({ week, value })).reverse();
}

const creditsChartConfig = {
  value: { label: "Crédits utilisés", color: "hsl(var(--primary))" },
};

const projectsChartConfig = {
  value: { label: "Projets créés", color: "hsl(var(--accent))" },
};

export default function Admin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [refundDialog, setRefundDialog] = useState<{ open: boolean; userId: string; reason: string }>({
    open: false, userId: "", reason: "",
  });
  const [refundAmount, setRefundAmount] = useState("");

  const adminAction = useCallback(async (action: string, params: Record<string, any>) => {
    setActionLoading(`${action}-${params.project_id || params.flag_id || params.user_id || ""}`);
    try {
      const { data, error } = await supabase.functions.invoke("admin-actions", {
        body: { action, ...params },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Succès", description: `${action.replace(/_/g, " ")} terminé` });
      qc.invalidateQueries({ queryKey: ["admin-projects"] });
      qc.invalidateQueries({ queryKey: ["admin-jobs"] });
      qc.invalidateQueries({ queryKey: ["admin-flags"] });
      qc.invalidateQueries({ queryKey: ["admin-ledger"] });
      qc.invalidateQueries({ queryKey: ["admin-renders"] });
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Une erreur inattendue s'est produite";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }, [qc, toast]);

  const { data: isAdmin, isLoading: checkingRole } = useQuery({
    queryKey: ["isAdmin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.rpc("has_role", { _role: "admin" as const, _user_id: user.id });
      return !!data;
    },
    enabled: !!user,
  });

  const { data: projects, isLoading } = useQuery({
    queryKey: ["admin-projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  const { data: jobs } = useQuery({
    queryKey: ["admin-jobs"],
    queryFn: async () => {
      const { data } = await supabase.from("job_queue").select("*").order("created_at", { ascending: false }).limit(100);
      return data || [];
    },
    enabled: !!isAdmin,
    refetchInterval: 10000,
  });

  const { data: renders } = useQuery({
    queryKey: ["admin-renders"],
    queryFn: async () => {
      const { data } = await supabase.from("renders").select("*").order("created_at", { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!isAdmin,
  });

  const { data: flags } = useQuery({
    queryKey: ["admin-flags"],
    queryFn: async () => {
      const { data } = await supabase.from("moderation_flags").select("*").order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!isAdmin,
  });

  const { data: ledger } = useQuery({
    queryKey: ["admin-ledger"],
    queryFn: async () => {
      const { data } = await supabase.from("credit_ledger").select("*").order("created_at", { ascending: false }).limit(200);
      return data || [];
    },
    enabled: !!isAdmin,
  });

  const creditsPerDay = useMemo(() => {
    if (!ledger) return [];
    const debits = ledger.filter(l => l.delta < 0);
    return groupByDay(debits, "sum").slice(-14);
  }, [ledger]);

  const projectsPerWeek = useMemo(() => {
    if (!projects) return [];
    return groupByWeek(projects).slice(-8);
  }, [projects]);

  if (checkingRole) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center py-20 text-muted-foreground">
          <Shield className="h-16 w-16 mb-4" />
          <p className="text-xl font-medium">Accès refusé</p>
          <p>Privilèges administrateur requis</p>
        </div>
      </div>
    );
  }

  const activeJobs = jobs?.filter(j => j.status === "processing") || [];
  const failedJobs = jobs?.filter(j => j.status === "failed") || [];
  const totalDebits = ledger?.filter(l => l.delta < 0).reduce((s, l) => s + Math.abs(l.delta), 0) || 0;
  const pendingRenders = renders?.filter(r => r.status === "pending" || r.status === "processing") || [];
  const activeProjects = projects?.filter(p => ["generating", "analyzing", "planning", "stitching"].includes(p.status)) || [];

  const isActionLoading = (key: string) => actionLoading === key;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
          <Shield className="h-8 w-8 text-primary" /> Supervision admin
        </h1>

        {/* KPI Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mb-8">
          <Card className="border-border/50 bg-card/60">
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-primary">{projects?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Total projets</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/60">
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-chart-2">{activeProjects.length}</div>
              <p className="text-xs text-muted-foreground">Pipelines actifs</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/60">
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-chart-4">{activeJobs.length}</div>
              <p className="text-xs text-muted-foreground">Jobs en cours</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/60">
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-destructive">{failedJobs.length}</div>
              <p className="text-xs text-muted-foreground">Jobs échoués</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/60">
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-chart-1">{totalDebits}</div>
              <p className="text-xs text-muted-foreground">Crédits utilisés</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/60">
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-chart-3">{pendingRenders.length}</div>
              <p className="text-xs text-muted-foreground">Rendus en attente</p>
            </CardContent>
          </Card>
        </div>

        {/* Trend Charts */}
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <Card className="border-border/50 bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Crédits utilisés par jour
              </CardTitle>
            </CardHeader>
            <CardContent>
              {creditsPerDay.length > 0 ? (
                <ChartContainer config={creditsChartConfig} className="h-[200px] w-full">
                  <BarChart data={creditsPerDay}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis dataKey="day" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-accent" />
                Projets créés par semaine
              </CardTitle>
            </CardHeader>
            <CardContent>
              {projectsPerWeek.length > 0 ? (
                <ChartContainer config={projectsChartConfig} className="h-[200px] w-full">
                  <LineChart data={projectsPerWeek}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis dataKey="week" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="value" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ fill: "hsl(var(--accent))" }} />
                  </LineChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Series Studio Admin Links */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/agents">Agents IA</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/providers">Fournisseurs</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/audit">Journal d'audit</Link>
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="jobs" className="space-y-4">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="bg-muted/50 w-max sm:w-auto">
              <TabsTrigger value="jobs" className="gap-1 text-xs sm:text-sm"><Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Jobs</TabsTrigger>
              <TabsTrigger value="projects" className="gap-1 text-xs sm:text-sm"><Clapperboard className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Projets</TabsTrigger>
              <TabsTrigger value="credits" className="gap-1 text-xs sm:text-sm"><CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Crédits</TabsTrigger>
              <TabsTrigger value="renders" className="gap-1 text-xs sm:text-sm"><Film className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Rendus</TabsTrigger>
              <TabsTrigger value="flags" className="gap-1 text-xs sm:text-sm"><AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Signalements</span><span className="sm:hidden">Flags</span> ({flags?.filter(f => f.status === "pending").length || 0})</TabsTrigger>
            </TabsList>
          </div>

          {/* JOBS TAB */}
          <TabsContent value="jobs">
            <Card className="border-border/50 bg-card/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  File de jobs ({jobs?.length || 0} au total)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="table-responsive">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Étape</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Tentatives</TableHead>
                      <TableHead>Démarré</TableHead>
                      <TableHead>Durée</TableHead>
                      <TableHead>Erreur</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs?.map((j) => {
                      const dur = j.started_at && j.completed_at
                        ? `${((new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()) / 1000).toFixed(1)}s`
                        : j.started_at ? "en cours…" : "—";
                      return (
                        <TableRow key={j.id}>
                          <TableCell className="font-mono text-xs">{j.step}</TableCell>
                          <TableCell><StatusBadge status={j.status} /></TableCell>
                          <TableCell className="text-xs">{j.retry_count || 0}/{j.max_retries || 3}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {j.started_at ? new Date(j.started_at).toLocaleTimeString("fr-FR") : "—"}
                          </TableCell>
                          <TableCell className="text-xs font-mono">{dur}</TableCell>
                          <TableCell className="text-xs text-destructive max-w-[200px] truncate">{j.error_message || "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PROJECTS TAB */}
          <TabsContent value="projects">
            <Card className="border-border/50 bg-card/60">
              <CardHeader><CardTitle>Tous les projets</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : (
                  <div className="table-responsive">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Titre</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Style</TableHead>
                        <TableHead className="hidden sm:table-cell">Fournisseur</TableHead>
                        <TableHead className="hidden sm:table-cell">Créé le</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projects?.map((p) => {
                        const canCancel = !["completed", "failed", "cancelled", "draft"].includes(p.status);
                        const cancelKey = `cancel_project-${p.id}`;
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.title}</TableCell>
                            <TableCell><Badge variant="outline">{typeLabels[p.type] || p.type}</Badge></TableCell>
                            <TableCell><StatusBadge status={p.status} /></TableCell>
                            <TableCell className="text-xs">{styleLabels[p.style_preset || ""] || p.style_preset || "—"}</TableCell>
                            <TableCell className="text-xs font-mono hidden sm:table-cell">{p.provider_default || "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">{new Date(p.created_at).toLocaleDateString("fr-FR")}</TableCell>
                            <TableCell className="text-right space-x-1">
                              {canCancel && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  disabled={isActionLoading(cancelKey)}
                                  onClick={() => adminAction("cancel_project", { project_id: p.id })}
                                >
                                  {isActionLoading(cancelKey) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
                                  Annuler
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => setRefundDialog({ open: true, userId: p.user_id, reason: `Remboursement projet : ${p.title}` })}
                              >
                                <RotateCcw className="h-3 w-3" /> Rembourser
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CREDITS TAB */}
          <TabsContent value="credits">
            <Card className="border-border/50 bg-card/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Activité récente ({ledger?.length || 0} entrées)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="table-responsive">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Delta</TableHead>
                      <TableHead>Raison</TableHead>
                      <TableHead className="hidden sm:table-cell">Type</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledger?.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className={`font-bold ${l.delta < 0 ? "text-destructive" : "text-chart-2"}`}>
                          {l.delta > 0 ? "+" : ""}{l.delta}
                        </TableCell>
                        <TableCell className="text-sm">{l.reason}</TableCell>
                        <TableCell className="hidden sm:table-cell"><Badge variant="outline" className="text-xs">{l.ref_type || "—"}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleDateString("fr-FR")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* RENDERS TAB */}
          <TabsContent value="renders">
            <Card className="border-border/50 bg-card/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Film className="h-5 w-5 text-primary" />
                  Rendus ({renders?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="table-responsive">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID Projet</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>URL 16:9</TableHead>
                      <TableHead>URL 9:16</TableHead>
                      <TableHead className="hidden sm:table-cell">Créé le</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {renders?.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.project_id.slice(0, 8)}…</TableCell>
                        <TableCell><StatusBadge status={r.status} /></TableCell>
                        <TableCell className="text-xs">
                          {r.master_url_16_9 ? <a href={r.master_url_16_9} target="_blank" rel="noreferrer" className="text-primary underline">Voir</a> : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.master_url_9_16 ? <a href={r.master_url_9_16} target="_blank" rel="noreferrer" className="text-primary underline">Voir</a> : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">{new Date(r.created_at).toLocaleString("fr-FR")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FLAGS TAB */}
          <TabsContent value="flags">
            <Card className="border-border/50 bg-card/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Signalements de modération ({flags?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {flags && flags.length > 0 ? (
                  <div className="table-responsive">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Projet</TableHead>
                        <TableHead>Raison</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="hidden sm:table-cell">Créé le</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {flags.map((f) => {
                        const isPending = f.status === "pending";
                        const resolveKey = `resolve_flag-${f.id}`;
                        const dismissKey = `dismiss_flag-${f.id}`;
                        return (
                          <TableRow key={f.id}>
                            <TableCell className="font-mono text-xs">{f.project_id.slice(0, 8)}…</TableCell>
                            <TableCell className="text-sm">{f.reason}</TableCell>
                            <TableCell><StatusBadge status={f.status} /></TableCell>
                            <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">{new Date(f.created_at).toLocaleString("fr-FR")}</TableCell>
                            <TableCell className="text-right space-x-1">
                              {isPending && (
                                <>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                    disabled={isActionLoading(resolveKey)}
                                    onClick={() => adminAction("resolve_flag", { flag_id: f.id, resolution: "resolved" })}
                                  >
                                    {isActionLoading(resolveKey) ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
                                    Résoudre
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                    disabled={isActionLoading(dismissKey)}
                                    onClick={() => adminAction("resolve_flag", { flag_id: f.id, resolution: "dismissed" })}
                                  >
                                    {isActionLoading(dismissKey) ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                                    Rejeter
                                  </Button>
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">Aucun signalement</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Refund Dialog */}
      <Dialog open={refundDialog.open} onOpenChange={(open) => setRefundDialog(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rembourser des crédits</DialogTitle>
            <DialogDescription>
              Entrez le montant de crédits à rembourser à cet utilisateur.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm text-muted-foreground">ID utilisateur</label>
              <Input value={refundDialog.userId} disabled className="font-mono text-xs" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Montant</label>
              <Input
                type="number"
                min="1"
                placeholder="10"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Raison</label>
              <Input
                value={refundDialog.reason}
                onChange={(e) => setRefundDialog(prev => ({ ...prev, reason: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialog(prev => ({ ...prev, open: false }))}>Annuler</Button>
            <Button
              disabled={!refundAmount || Number(refundAmount) <= 0 || actionLoading !== null}
              onClick={async () => {
                await adminAction("refund_credits", {
                  user_id: refundDialog.userId,
                  amount: Number(refundAmount),
                  reason: refundDialog.reason,
                });
                setRefundDialog({ open: false, userId: "", reason: "" });
                setRefundAmount("");
              }}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />}
              Rembourser {refundAmount || 0} crédits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
}
