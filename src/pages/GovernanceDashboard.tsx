import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Shield, AlertTriangle, Activity, DollarSign, FileCheck, Truck } from "lucide-react";
import { useProjectGovernanceDashboard, useGovernancePolicies, useGovernanceTransitions } from "@/hooks/useGovernance";
import { useReviewGates } from "@/hooks/useReviewGates";
import { useExportVersions } from "@/hooks/useExportVersions";
import { useProjectBudget } from "@/hooks/useProjectBudget";
import { GOVERNANCE_STATE_LABELS, type GovernanceState } from "@/lib/governance-engine";
import { IncidentFeed } from "@/components/studio/IncidentFeed";
import { PolicyViolationAlert } from "@/components/studio/PolicyViolationAlert";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import usePageTitle from "@/hooks/usePageTitle";

export default function GovernanceDashboard() {
  usePageTitle("Governance");
  const { id: projectId } = useParams<{ id: string }>();
  const { state, violations, incidents, isLoading } = useProjectGovernanceDashboard(projectId);
  const { data: policies } = useGovernancePolicies();
  const { data: transitions } = useGovernanceTransitions();
  const { data: gates } = useReviewGates(projectId ?? "");
  const { data: exports } = useExportVersions(projectId ?? "");
  const { data: budget } = useProjectBudget(projectId ?? "");

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Chargement…</div>;
  }

  const govState = (state?.governance_state ?? "draft") as GovernanceState;
  const pendingGates = gates?.filter((g) => g.status === "pending") ?? [];
  const activeIncidents = incidents.filter((i) => i.status === "open");
  const unresolvedViolations = violations.filter((v) => !v.resolved);
  const pendingExports = exports?.filter((e) => e.status === "pending" || e.status === "rendering") ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: state?.title ?? "Projet", href: `/project/${projectId}` },
            { label: "Governance" },
          ]}
        />

        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Governance Dashboard</h1>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">État projet</p>
              <Badge variant="secondary" className="text-xs">
                {GOVERNANCE_STATE_LABELS[govState] ?? govState}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Revues en attente</p>
              <p className="text-2xl font-bold">{pendingGates.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Incidents ouverts</p>
              <p className="text-2xl font-bold text-destructive">{activeIncidents.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Violations</p>
              <p className="text-2xl font-bold text-yellow-500">{unresolvedViolations.length}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="state">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="state"><Activity className="h-3 w-3 mr-1" />État</TabsTrigger>
            <TabsTrigger value="reviews"><FileCheck className="h-3 w-3 mr-1" />Revues</TabsTrigger>
            <TabsTrigger value="violations"><AlertTriangle className="h-3 w-3 mr-1" />Violations</TabsTrigger>
            <TabsTrigger value="incidents"><Shield className="h-3 w-3 mr-1" />Incidents</TabsTrigger>
            <TabsTrigger value="cost"><DollarSign className="h-3 w-3 mr-1" />Coûts</TabsTrigger>
            <TabsTrigger value="exports"><Truck className="h-3 w-3 mr-1" />Exports</TabsTrigger>
          </TabsList>

          {/* Project State */}
          <TabsContent value="state" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">État du projet & transitions</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-xs text-muted-foreground">État actuel :</span>
                  <Badge className="ml-2">{GOVERNANCE_STATE_LABELS[govState]}</Badge>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Transitions autorisées depuis cet état :</p>
                  <div className="flex flex-wrap gap-2">
                    {transitions
                      ?.filter((t) => t.from_state === govState)
                      .map((t) => (
                        <Badge key={t.id} variant="outline" className="text-xs">
                          → {GOVERNANCE_STATE_LABELS[t.to_state as GovernanceState] ?? t.to_state}
                        </Badge>
                      )) ?? <span className="text-xs text-muted-foreground">Aucune</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pending Reviews */}
          <TabsContent value="reviews" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Review Gates en attente</CardTitle></CardHeader>
              <CardContent>
                {pendingGates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune revue en attente</p>
                ) : (
                  <div className="space-y-2">
                    {pendingGates.map((g) => (
                      <div key={g.id} className="flex items-center justify-between border rounded-md p-2">
                        <span className="text-sm">{g.gate_type}</span>
                        <Badge variant="outline">{g.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Violations */}
          <TabsContent value="violations">
            <Card>
              <CardHeader><CardTitle className="text-sm">Policy Violations</CardTitle></CardHeader>
              <CardContent>
                <PolicyViolationAlert violations={violations} />
                {unresolvedViolations.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucune violation active</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Incidents */}
          <TabsContent value="incidents">
            <Card>
              <CardHeader><CardTitle className="text-sm">Incidents</CardTitle></CardHeader>
              <CardContent>
                <IncidentFeed incidents={incidents} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cost */}
          <TabsContent value="cost">
            <Card>
              <CardHeader><CardTitle className="text-sm">Budget & Coûts</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {budget ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span>Mode de coût</span>
                      <Badge variant="outline">{budget.cost_mode}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Plafond</span>
                      <span>{budget.budget_limit_credits ?? "—"} crédits</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Estimé</span>
                      <span>{budget.estimated_total_cost ?? 0} crédits</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Réel</span>
                      <span>{budget.actual_total_cost ?? 0} crédits</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucun budget configuré</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Exports */}
          <TabsContent value="exports">
            <Card>
              <CardHeader><CardTitle className="text-sm">Exports</CardTitle></CardHeader>
              <CardContent>
                {(exports?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucun export</p>
                ) : (
                  <div className="space-y-2">
                    {exports?.map((exp) => (
                      <div key={exp.id} className="flex items-center justify-between border rounded-md p-2">
                        <div className="text-sm">
                          <span className="font-medium">v{exp.version}</span>
                          <span className="text-muted-foreground ml-2">{exp.resolution} • {exp.format}</span>
                        </div>
                        <Badge variant={exp.status === "completed" ? "default" : "outline"}>
                          {exp.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Active Policies */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Politiques actives ({policies?.length ?? 0})</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {policies?.map((p) => (
                <div key={p.id} className="flex items-center gap-2 border rounded-md p-2">
                  <Badge variant={p.enforcement_mode === "block" ? "destructive" : "outline"} className="text-[10px] shrink-0">
                    {p.enforcement_mode}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{p.policy_key.replace(/_/g, " ")}</p>
                    {p.description && <p className="text-[10px] text-muted-foreground truncate">{p.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
