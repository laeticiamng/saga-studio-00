import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
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
  Loader2, Shield, Activity, CreditCard, Film, Clapperboard, AlertTriangle,
  CheckCircle, Clock, XCircle, Ban, RotateCcw, CheckCheck, Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
      {s.icon} {status}
    </Badge>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Refund dialog state
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
      toast({ title: "Success", description: `${action.replace(/_/g, " ")} completed` });
      // Invalidate all admin queries
      qc.invalidateQueries({ queryKey: ["admin-projects"] });
      qc.invalidateQueries({ queryKey: ["admin-jobs"] });
      qc.invalidateQueries({ queryKey: ["admin-flags"] });
      qc.invalidateQueries({ queryKey: ["admin-ledger"] });
      qc.invalidateQueries({ queryKey: ["admin-renders"] });
      return data;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }, [qc, toast]);

  const { data: isAdmin, isLoading: checkingRole } = useQuery({
    queryKey: ["isAdmin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin");
      return (data && data.length > 0) || false;
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
      const { data } = await supabase.from("credit_ledger").select("*").order("created_at", { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!isAdmin,
  });

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
          <p className="text-xl font-medium">Access Denied</p>
          <p>Admin privileges required</p>
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
          <Shield className="h-8 w-8 text-primary" /> Admin Monitoring
        </h1>

        {/* KPI Cards */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-6 mb-8">
          <Card className="border-border/50 bg-card/60">
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-primary">{projects?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Total Projects</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/60">
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-chart-2">{activeProjects.length}</div>
              <p className="text-xs text-muted-foreground">Active Pipelines</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/60">
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-chart-4">{activeJobs.length}</div>
              <p className="text-xs text-muted-foreground">Processing Jobs</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/60">
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-destructive">{failedJobs.length}</div>
              <p className="text-xs text-muted-foreground">Failed Jobs</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/60">
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-chart-1">{totalDebits}</div>
              <p className="text-xs text-muted-foreground">Credits Used</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/60">
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-chart-3">{pendingRenders.length}</div>
              <p className="text-xs text-muted-foreground">Pending Renders</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="jobs" className="space-y-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="jobs" className="gap-1"><Activity className="h-4 w-4" /> Jobs</TabsTrigger>
            <TabsTrigger value="projects" className="gap-1"><Clapperboard className="h-4 w-4" /> Projects</TabsTrigger>
            <TabsTrigger value="credits" className="gap-1"><CreditCard className="h-4 w-4" /> Credits</TabsTrigger>
            <TabsTrigger value="renders" className="gap-1"><Film className="h-4 w-4" /> Renders</TabsTrigger>
            <TabsTrigger value="flags" className="gap-1"><AlertTriangle className="h-4 w-4" /> Flags ({flags?.filter(f => f.status === "pending").length || 0})</TabsTrigger>
          </TabsList>

          {/* JOBS TAB */}
          <TabsContent value="jobs">
            <Card className="border-border/50 bg-card/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Job Queue ({jobs?.length || 0} total)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Step</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Retries</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs?.map((j) => {
                      const dur = j.started_at && j.completed_at
                        ? `${((new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()) / 1000).toFixed(1)}s`
                        : j.started_at ? "running…" : "—";
                      return (
                        <TableRow key={j.id}>
                          <TableCell className="font-mono text-xs">{j.step}</TableCell>
                          <TableCell><StatusBadge status={j.status} /></TableCell>
                          <TableCell className="text-xs">{j.retry_count || 0}/{j.max_retries || 3}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {j.started_at ? new Date(j.started_at).toLocaleTimeString() : "—"}
                          </TableCell>
                          <TableCell className="text-xs font-mono">{dur}</TableCell>
                          <TableCell className="text-xs text-destructive max-w-[200px] truncate">{j.error_message || "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PROJECTS TAB */}
          <TabsContent value="projects">
            <Card className="border-border/50 bg-card/60">
              <CardHeader><CardTitle>All Projects</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Style</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projects?.map((p) => {
                        const canCancel = !["completed", "failed", "cancelled", "draft"].includes(p.status);
                        const cancelKey = `cancel_project-${p.id}`;
                        const refundKey = `refund-${p.user_id}`;
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.title}</TableCell>
                            <TableCell><Badge variant="outline">{p.type}</Badge></TableCell>
                            <TableCell><StatusBadge status={p.status} /></TableCell>
                            <TableCell className="capitalize text-xs">{p.style_preset || "—"}</TableCell>
                            <TableCell className="text-xs font-mono">{p.provider_default || "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</TableCell>
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
                                  Cancel
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => setRefundDialog({ open: true, userId: p.user_id, reason: `Refund for project: ${p.title}` })}
                              >
                                <RotateCcw className="h-3 w-3" /> Refund
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
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
                  Recent Credit Activity ({ledger?.length || 0} entries)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Delta</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledger?.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className={`font-bold ${l.delta < 0 ? "text-destructive" : "text-chart-2"}`}>
                          {l.delta > 0 ? "+" : ""}{l.delta}
                        </TableCell>
                        <TableCell className="text-sm">{l.reason}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{l.ref_type || "—"}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* RENDERS TAB */}
          <TabsContent value="renders">
            <Card className="border-border/50 bg-card/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Film className="h-5 w-5 text-primary" />
                  Renders ({renders?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>16:9 URL</TableHead>
                      <TableHead>9:16 URL</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {renders?.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.project_id.slice(0, 8)}…</TableCell>
                        <TableCell><StatusBadge status={r.status} /></TableCell>
                        <TableCell className="text-xs">
                          {r.master_url_16_9 ? <a href={r.master_url_16_9} target="_blank" rel="noreferrer" className="text-primary underline">View</a> : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.master_url_9_16 ? <a href={r.master_url_9_16} target="_blank" rel="noreferrer" className="text-primary underline">View</a> : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FLAGS TAB */}
          <TabsContent value="flags">
            <Card className="border-border/50 bg-card/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Moderation Flags ({flags?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {flags && flags.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
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
                            <TableCell className="text-xs text-muted-foreground">{new Date(f.created_at).toLocaleString()}</TableCell>
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
                                    Resolve
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                    disabled={isActionLoading(dismissKey)}
                                    onClick={() => adminAction("resolve_flag", { flag_id: f.id, resolution: "dismissed" })}
                                  >
                                    {isActionLoading(dismissKey) ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                                    Dismiss
                                  </Button>
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No flags</p>
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
            <DialogTitle>Refund Credits</DialogTitle>
            <DialogDescription>
              Enter the amount of credits to refund to this user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm text-muted-foreground">User ID</label>
              <Input value={refundDialog.userId} disabled className="font-mono text-xs" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Amount</label>
              <Input
                type="number"
                min="1"
                placeholder="10"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Reason</label>
              <Input
                value={refundDialog.reason}
                onChange={(e) => setRefundDialog(prev => ({ ...prev, reason: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialog(prev => ({ ...prev, open: false }))}>Cancel</Button>
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
              Refund {refundAmount || 0} credits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
