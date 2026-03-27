import { useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import Footer from "@/components/Footer";
import { useSeries } from "@/hooks/useSeries";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useContinuityNodes, useContinuityEdges, useContinuityConflicts } from "@/hooks/useContinuity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Network, AlertTriangle, CheckCircle, User, MapPin, Shirt, Package } from "lucide-react";

const NODE_ICONS: Record<string, React.ReactNode> = {
  character: <User className="h-4 w-4" />,
  location: <MapPin className="h-4 w-4" />,
  costume: <Shirt className="h-4 w-4" />,
  prop: <Package className="h-4 w-4" />,
};

const SEVERITY_COLORS: Record<string, string> = {
  info: "text-blue-600",
  warning: "text-yellow-600",
  error: "text-red-600",
  critical: "text-red-800 font-bold",
};

export default function ContinuityCenter() {
  usePageTitle("Centre de continuité");
  const { id: seriesId } = useParams<{ id: string }>();
  const { data: series } = useSeries(seriesId);

  const { data: nodes, isLoading: nodesLoading } = useContinuityNodes(seriesId);
  const { data: edges } = useContinuityEdges(seriesId);
  const { data: conflicts } = useContinuityConflicts(seriesId);

  const unresolvedConflicts = conflicts?.filter(c => !c.resolved) || [];
  const resolvedConflicts = conflicts?.filter(c => c.resolved) || [];

  const nodesByType: Record<string, typeof nodes> = {};
  nodes?.forEach(node => {
    if (!nodesByType[node.node_type]) nodesByType[node.node_type] = [];
    nodesByType[node.node_type]!.push(node);
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto py-8 max-w-6xl">
      <Breadcrumbs items={[
        { label: "Mes projets", href: "/dashboard" },
        { label: String((series?.project as any)?.title || "Série"), href: `/series/${seriesId}` },
        { label: "Continuité" },
      ]} />
      <h1 className="text-3xl font-bold flex items-center gap-2 mb-6">
        <Network className="h-8 w-8" /> Centre de continuité
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold">{nodes?.length || 0}</p>
            <p className="text-sm text-muted-foreground">Noeuds mémoire</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold">{edges?.length || 0}</p>
            <p className="text-sm text-muted-foreground">Relations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-red-600">{unresolvedConflicts.length}</p>
            <p className="text-sm text-muted-foreground">Conflits actifs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-green-600">{resolvedConflicts.length}</p>
            <p className="text-sm text-muted-foreground">Conflits résolus</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="conflicts">
        <TabsList>
          <TabsTrigger value="conflicts">
            Conflits ({unresolvedConflicts.length})
          </TabsTrigger>
          <TabsTrigger value="memory">Mémoire ({nodes?.length || 0})</TabsTrigger>
          <TabsTrigger value="relations">Relations ({edges?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="conflicts">
          {unresolvedConflicts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                Aucun conflit de continuité détecté
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {unresolvedConflicts.map(conflict => (
                <Card key={conflict.id} className="border-l-4 border-l-yellow-500">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`h-5 w-5 mt-0.5 ${SEVERITY_COLORS[conflict.severity]}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{conflict.conflict_type?.replace(/_/g, " ")}</Badge>
                          <Badge variant={conflict.severity === "critical" ? "destructive" : "secondary"}>
                            {conflict.severity}
                          </Badge>
                        </div>
                        <p className="text-sm">{conflict.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(conflict.created_at).toLocaleDateString("fr-FR", { dateStyle: "medium" })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="memory">
          {nodesLoading ? (
            <p className="text-muted-foreground">Chargement...</p>
          ) : !nodes || nodes.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                La mémoire de continuité se construit au fur et à mesure du pipeline.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(nodesByType).map(([type, typeNodes]) => (
                <div key={type}>
                  <h3 className="text-lg font-semibold capitalize flex items-center gap-2 mb-3">
                    {NODE_ICONS[type] || <Network className="h-4 w-4" />}
                    {type.replace(/_/g, " ")} ({typeNodes?.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {typeNodes?.map(node => (
                      <Card key={node.id}>
                        <CardContent className="py-3">
                          <p className="font-medium">{node.label}</p>
                          {node.properties && Object.keys(node.properties).length > 0 && (
                            <div className="mt-2 text-xs text-muted-foreground space-y-1">
                              {Object.entries(node.properties as Record<string, unknown>).slice(0, 4).map(([k, v]) => (
                                <p key={k}><span className="font-medium">{k}:</span> {String(v).slice(0, 60)}</p>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="relations">
          {!edges || edges.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Les relations se construisent au fur et à mesure du pipeline.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {edges.map((edge: Record<string, unknown>) => (
                <div key={edge.id as string} className="flex items-center gap-3 p-3 rounded-lg border">
                  <Badge variant="outline">{(edge.source as Record<string, unknown>)?.label as string}</Badge>
                  <span className="text-sm text-muted-foreground">
                    — {(edge.edge_type as string)?.replace(/_/g, " ")} —
                  </span>
                  <Badge variant="outline">{(edge.target as Record<string, unknown>)?.label as string}</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      </main>
      <Footer />
    </div>
  );
}
