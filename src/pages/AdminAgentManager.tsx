import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAgentRegistry } from "@/hooks/useAgentRuns";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Loader2, Cpu } from "lucide-react";

export default function AdminAgentManager() {
  const { data: agents, isLoading } = useAgentRegistry();
  usePageTitle("Gestion des agents");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container max-w-5xl py-8">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Cpu className="h-6 w-6" />
          Gestion des agents IA
        </h1>

        {isLoading ? (
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        ) : (
          <div className="space-y-3">
            {agents?.map((agent) => (
              <Card key={agent.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{agent.name}</h3>
                        <Badge variant="outline">{agent.slug}</Badge>
                        <Badge variant="secondary">{agent.category}</Badge>
                        <Badge variant="outline">{agent.role}</Badge>
                      </div>
                      {agent.description && (
                        <p className="text-sm text-muted-foreground mt-1">{agent.description}</p>
                      )}
                      {agent.dependencies && agent.dependencies.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Dépendances: {agent.dependencies.join(", ")}
                        </p>
                      )}
                    </div>
                    <Badge variant={agent.status === "active" ? "default" : "destructive"}>
                      {agent.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
