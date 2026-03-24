import { useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAgentRuns, useAgentRegistry } from "@/hooks/useAgentRuns";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Loader2, Activity, Cpu, Clock, Coins } from "lucide-react";

export default function AgentDashboard() {
  const { id: seriesId } = useParams<{ id: string }>();
  const { data: agentRuns, isLoading } = useAgentRuns({ seriesId });
  const { data: agents } = useAgentRegistry();
  usePageTitle("Agents");

  const stats = {
    total: agentRuns?.length ?? 0,
    completed: agentRuns?.filter((r) => r.status === "completed").length ?? 0,
    failed: agentRuns?.filter((r) => r.status === "failed").length ?? 0,
    running: agentRuns?.filter((r) => r.status === "running").length ?? 0,
    totalCredits: agentRuns?.reduce((sum, r) => sum + (r.cost_credits ?? 0), 0) ?? 0,
    avgLatency: agentRuns && agentRuns.length > 0
      ? Math.round(agentRuns.reduce((sum, r) => sum + (r.latency_ms ?? 0), 0) / agentRuns.length)
      : 0,
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container max-w-5xl py-8">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Activity className="h-6 w-6" />
          Tableau de bord des agents
        </h1>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <Cpu className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Exécutions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Activity className="h-5 w-5 mx-auto mb-1 text-green-500" />
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">Réussies</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="h-5 w-5 mx-auto mb-1 text-blue-500" />
              <p className="text-2xl font-bold">{stats.avgLatency}ms</p>
              <p className="text-xs text-muted-foreground">Latence moy.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Coins className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
              <p className="text-2xl font-bold">{stats.totalCredits}</p>
              <p className="text-xs text-muted-foreground">Crédits</p>
            </CardContent>
          </Card>
        </div>

        {/* Agent Registry */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Agents disponibles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {agents?.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <span className="font-medium text-sm">{agent.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{agent.category}</span>
                  </div>
                  <Badge variant={agent.status === "active" ? "secondary" : "outline"}>
                    {agent.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Runs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Exécutions récentes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            ) : agentRuns && agentRuns.length > 0 ? (
              <div className="space-y-2">
                {agentRuns.slice(0, 20).map((run: any) => (
                  <div key={run.id} className="flex items-center justify-between p-2 border rounded text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{run.agent?.name || run.agent_slug}</span>
                      {run.model_used && (
                        <span className="text-xs text-muted-foreground">{run.model_used}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {run.latency_ms && (
                        <span className="text-xs text-muted-foreground">{run.latency_ms}ms</span>
                      )}
                      <Badge variant={
                        run.status === "completed" ? "secondary" :
                        run.status === "failed" ? "destructive" :
                        run.status === "running" ? "default" : "outline"
                      }>
                        {run.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune exécution
              </p>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
