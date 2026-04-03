import { useParams, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SeriesNotFound } from "@/components/SeriesNotFound";
import Footer from "@/components/Footer";
import { useSeries } from "@/hooks/useSeries";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useApprovalStepsBySeries } from "@/hooks/useApprovals";
import { useApprovalEvaluate } from "@/hooks/useWorkflow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle, XCircle, RotateCcw, Shield, Scale, Brain, Eye, Clapperboard } from "lucide-react";
import { useState } from "react";
import { getSeriesProjectTitle } from "@/lib/series-helpers";

interface EpisodeInfo {
  id: string;
  number: number;
  title: string;
  season_id: string;
}

interface ApprovalWithEpisode {
  id: string;
  episode_id: string;
  step_name: string;
  status: string;
  reviewer_agent: string | null;
  reviewer_user: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  decisions: unknown[];
  _episode: EpisodeInfo | null;
}

const STEP_ICONS: Record<string, React.ReactNode> = {
  psychology_review: <Brain className="h-5 w-5" />,
  legal_ethics_review: <Scale className="h-5 w-5" />,
  continuity_check: <Eye className="h-5 w-5" />,
  shot_review: <Clapperboard className="h-5 w-5" />,
  edit_review: <Clapperboard className="h-5 w-5" />,
};

const STEP_LABELS: Record<string, string> = {
  psychology_review: "Revue psychologique",
  legal_ethics_review: "Revue juridique/éthique",
  continuity_check: "Vérification continuité",
  shot_review: "Revue des plans",
  edit_review: "Revue montage",
};

export default function ApprovalInbox() {
  usePageTitle("Approbations");
  const { id: seriesId } = useParams<{ id: string }>();
  const { data: series, isLoading: seriesLoading } = useSeries(seriesId);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const { data: approvals, isLoading } = useApprovalStepsBySeries(seriesId);
  const approvalEvaluate = useApprovalEvaluate();

  if (!seriesLoading && !series) return <SeriesNotFound />;

  const pendingApprovals = (approvals as ApprovalWithEpisode[] | undefined)?.filter(a => a.status === "pending") || [];
  const recentDecisions = (approvals as ApprovalWithEpisode[] | undefined)?.filter(a => a.status !== "pending").slice(0, 20) || [];

  const handleDecision = async (approval: { episode_id: string; step_name: string }, decision: "approved" | "rejected" | "revision_requested") => {
    try {
      await approvalEvaluate.mutateAsync({
        episodeId: approval.episode_id,
        stepName: approval.step_name,
        decision,
        reason: reasons[approval.episode_id + approval.step_name] || undefined,
      });
      toast.success(
        decision === "approved" ? "Approuvé" :
        decision === "rejected" ? "Rejeté" : "Révision demandée"
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto py-8 max-w-4xl">
      <Breadcrumbs items={[
        { label: "Mes projets", href: "/dashboard" },
        { label: getSeriesProjectTitle(series), href: `/series/${seriesId}` },
        { label: "Approbations" },
      ]} />
      <h1 className="text-3xl font-bold flex items-center gap-2 mb-6">
        <Shield className="h-8 w-8" /> Boîte d'approbation
      </h1>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">
          En attente ({pendingApprovals.length})
        </h2>

        {isLoading && <p className="text-muted-foreground">Chargement...</p>}

        {pendingApprovals.length === 0 && !isLoading && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Aucune approbation en attente. La pipeline avance automatiquement.
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {pendingApprovals.map(approval => (
            <Card key={approval.id} className="border-yellow-500/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  {STEP_ICONS[approval.step_name] || <Shield className="h-5 w-5" />}
                  {STEP_LABELS[approval.step_name] || approval.step_name}
                  <Badge variant="destructive">En attente</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Épisode:{" "}
                  <Link
                    to={`/series/${seriesId}/episode/${approval.episode_id}`}
                    className="underline hover:text-primary"
                  >
                    {approval._episode
                      ? `Ép. ${approval._episode.number} — ${approval._episode.title}`
                      : approval.episode_id?.slice(0, 8) + "..."}
                  </Link>
                  {approval.reviewer_agent && ` — Agent: ${approval.reviewer_agent}`}
                </p>

                {approval.notes && (
                  <p className="text-sm mb-3 p-2 bg-muted rounded">{approval.notes}</p>
                )}

                <Textarea
                  placeholder="Raison (optionnel)..."
                  className="mb-3"
                  value={reasons[approval.episode_id + approval.step_name] || ""}
                  onChange={e => setReasons(prev => ({
                    ...prev,
                    [approval.episode_id + approval.step_name]: e.target.value,
                  }))}
                />

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleDecision(approval, "approved")}
                    disabled={approvalEvaluate.isPending}
                    size="sm"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" /> Approuver
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleDecision(approval, "revision_requested")}
                    disabled={approvalEvaluate.isPending}
                    size="sm"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" /> Révision
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleDecision(approval, "rejected")}
                    disabled={approvalEvaluate.isPending}
                    size="sm"
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Rejeter
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {recentDecisions.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Décisions récentes</h2>
          <div className="space-y-2">
            {recentDecisions.map(d => (
              <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg border">
                {STEP_ICONS[d.step_name] || <Shield className="h-4 w-4" />}
                <span className="flex-1 text-sm">{STEP_LABELS[d.step_name] || d.step_name}</span>
                <Badge variant={d.status === "approved" ? "default" : d.status === "rejected" ? "destructive" : "secondary"}>
                  {d.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(d.updated_at).toLocaleDateString("fr-FR")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      </main>
      <Footer />
    </div>
  );
}
