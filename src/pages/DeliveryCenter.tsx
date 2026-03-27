import { useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useDeliveryManifests, useQCReports, useExportJobs } from "@/hooks/useContinuity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Package, CheckCircle, XCircle, Download, FileCheck, AlertTriangle } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  pending_qc: "QC en cours",
  qc_passed: "QC validé",
  qc_failed: "QC échoué",
  delivered: "Livré",
  archived: "Archivé",
};

export default function DeliveryCenter() {
  usePageTitle("Centre de livraison");
  const { id: seriesId } = useParams<{ id: string }>();

  const { data: manifests, isLoading } = useDeliveryManifests(seriesId);
  const { data: exportJobs } = useExportJobs(seriesId);

  const handleRunQC = async (episodeId: string) => {
    try {
      const { error } = await supabase.functions.invoke("delivery-qc", {
        body: { episode_id: episodeId, series_id: seriesId },
      });
      if (error) throw error;
      toast.success("QC lancé");
    } catch {
      toast.error("Erreur lors du lancement du QC");
    }
  };

  const handleRunRedaction = async (episodeId: string) => {
    try {
      const { error } = await supabase.functions.invoke("redaction-pass", {
        body: { episode_id: episodeId, series_id: seriesId },
      });
      if (error) throw error;
      toast.success("Vérification compliance lancée");
    } catch {
      toast.error("Erreur lors de la vérification compliance");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto py-8 max-w-6xl">
      <h1 className="text-3xl font-bold flex items-center gap-2 mb-6">
        <Package className="h-8 w-8" /> Centre de livraison
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold">{manifests?.length || 0}</p>
            <p className="text-sm text-muted-foreground">Manifestes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {manifests?.filter(m => m.status === "qc_passed" || m.status === "delivered").length || 0}
            </p>
            <p className="text-sm text-muted-foreground">QC validés</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-red-600">
              {manifests?.filter(m => m.status === "qc_failed").length || 0}
            </p>
            <p className="text-sm text-muted-foreground">QC échoués</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold">
              {exportJobs?.filter(j => j.status === "completed").length || 0}
            </p>
            <p className="text-sm text-muted-foreground">Exports terminés</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="manifests">
        <TabsList>
          <TabsTrigger value="manifests">Manifestes</TabsTrigger>
          <TabsTrigger value="exports">Exports ({exportJobs?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="manifests">
          {isLoading ? (
            <p className="text-muted-foreground">Chargement...</p>
          ) : !manifests || manifests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Aucun manifeste de livraison. Les manifestes sont créés lors du QC final.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {manifests.map(manifest => {
                const metadata = manifest.metadata as Record<string, unknown> | null;
                const checks = (metadata?.checks || []) as Array<{ name: string; status: string; details: string }>;

                return (
                  <Card key={manifest.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-lg">
                        <span className="flex items-center gap-2">
                          {manifest.status === "qc_passed" || manifest.status === "delivered" ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : manifest.status === "qc_failed" ? (
                            <XCircle className="h-5 w-5 text-red-500" />
                          ) : (
                            <FileCheck className="h-5 w-5" />
                          )}
                          Épisode {manifest.episode_id?.slice(0, 8)}...
                        </span>
                        <Badge variant={
                          manifest.status === "qc_passed" || manifest.status === "delivered" ? "default" :
                          manifest.status === "qc_failed" ? "destructive" : "secondary"
                        }>
                          {STATUS_LABELS[manifest.status] || manifest.status}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {checks.length > 0 && (
                        <div className="space-y-2 mb-4">
                          {checks.map((check, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm">
                              {check.status === "pass" ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : check.status === "fail" ? (
                                <XCircle className="h-4 w-4 text-red-500" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                              )}
                              <span className="font-medium">{check.name}</span>
                              <span className="text-muted-foreground">{check.details}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        {manifest.episode_id && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => handleRunQC(manifest.episode_id!)}>
                              <FileCheck className="h-4 w-4 mr-1" /> Relancer QC
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleRunRedaction(manifest.episode_id!)}>
                              <AlertTriangle className="h-4 w-4 mr-1" /> Compliance
                            </Button>
                          </>
                        )}
                        {(manifest.status === "qc_passed" || manifest.status === "delivered") && (
                          <Button size="sm" onClick={() => handleExport(manifest.episode_id!)}>
                             <Download className="h-4 w-4 mr-1" /> Exporter
                           </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="exports">
          {!exportJobs || exportJobs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Aucun export en cours.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {exportJobs.map(job => (
                <Card key={job.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{job.export_type} — {job.format}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(job.created_at).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                      <Badge variant={job.status === "completed" ? "default" : job.status === "failed" ? "destructive" : "secondary"}>
                        {job.status}
                      </Badge>
                    </div>
                    {job.status === "processing" && (
                      <Progress value={50} className="h-2 mt-2" />
                    )}
                    {job.output_url && (
                      <Button size="sm" variant="link" className="mt-2 p-0" asChild>
                        <a href={job.output_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4 mr-1" /> Télécharger
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </Card>
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
