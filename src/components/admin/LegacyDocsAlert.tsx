import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, FileWarning } from "lucide-react";
import { toast } from "sonner";

interface Props {
  projectId?: string;
}

export default function LegacyDocsAlert({ projectId }: Props) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["legacy-docs-count", projectId],
    queryFn: async () => {
      let q = supabase
        .from("source_documents")
        .select("id", { count: "exact", head: true })
        .or("parser_version.is.null,parser_version.eq.legacy")
        .neq("status", "parsing_failed");
      if (projectId) q = q.eq("project_id", projectId);
      const { count } = await q;
      return count ?? 0;
    },
    staleTime: 60_000,
  });

  const reprocess = useMutation({
    mutationFn: async () => {
      const { data: result, error } = await supabase.functions.invoke(
        "reprocess-legacy-batch",
        { body: { project_id: projectId, limit: 5 } },
      );
      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      const ok = (result?.results ?? []).filter((r: { ok: boolean }) => r.ok).length;
      toast.success(`${ok} document(s) ré-analysé(s)`);
      qc.invalidateQueries({ queryKey: ["legacy-docs-count"] });
    },
    onError: (e: Error) => toast.error(`Échec ré-analyse: ${e.message}`),
  });

  if (isLoading || !data || data === 0) return null;

  return (
    <Alert className="border-amber-500/40 bg-amber-500/5">
      <FileWarning className="h-4 w-4 text-amber-400" />
      <AlertTitle className="text-amber-400">
        {data} document{data > 1 ? "s" : ""} avec un ancien parseur
      </AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-3 mt-2">
        <span className="text-sm">
          La précision du brain projet est dégradée. Ré-analyser corrige l'extraction sans ré-uploader.
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => reprocess.mutate()}
          disabled={reprocess.isPending}
        >
          {reprocess.isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              Ré-analyse…
            </>
          ) : (
            "Ré-analyser un lot"
          )}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
