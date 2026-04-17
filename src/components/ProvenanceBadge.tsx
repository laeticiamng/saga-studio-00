import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { FileText, Sparkles, ShieldCheck, AlertCircle } from "lucide-react";

interface ProvenanceBadgeProps {
  /** Project ID for the canonical_field lookup */
  projectId: string;
  /** Field key, e.g. 'title', 'synopsis', 'genre' */
  fieldKey: string;
  /** Optional entity type override */
  entityType?: string;
  /** Compact mode shows only icon */
  compact?: boolean;
}

interface ProvenanceData {
  id: string;
  confidence: number | null;
  inferred: boolean | null;
  approved: boolean | null;
  source_passage: string | null;
  source_document_id: string | null;
  source_document?: { file_name: string } | null;
}

/**
 * Visual badge that explains where a canonical field value comes from.
 * Tooltip shows: source document, confidence, page (if available), and approval state.
 */
export default function ProvenanceBadge({
  projectId,
  fieldKey,
  entityType = "project",
  compact = false,
}: ProvenanceBadgeProps) {
  const { data } = useQuery<ProvenanceData | null>({
    queryKey: ["provenance", projectId, entityType, fieldKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("canonical_fields")
        .select(
          "id, confidence, inferred, approved, source_passage, source_document_id, source_document:source_documents!source_document_id(file_name)",
        )
        .eq("project_id", projectId)
        .eq("entity_type", entityType)
        .eq("field_key", fieldKey)
        .maybeSingle();
      if (error) return null;
      return (data ?? null) as unknown as ProvenanceData | null;
    },
    enabled: !!projectId && !!fieldKey,
    staleTime: 60_000,
  });

  if (!data) return null;

  const confidence = data.confidence ?? 0;
  const confidencePct = Math.round(confidence * 100);
  const isApproved = data.approved === true;
  const isInferred = data.inferred === true;
  const sourceName =
    (data.source_document as { file_name?: string } | null)?.file_name ?? null;

  let icon = <FileText className="h-3 w-3" />;
  let variant: "default" | "outline" | "secondary" = "outline";
  let className = "text-muted-foreground";
  let label = "Source";

  if (isApproved) {
    icon = <ShieldCheck className="h-3 w-3" />;
    variant = "default";
    className = "text-emerald-400 border-emerald-500/40";
    label = "Validé";
  } else if (isInferred) {
    icon = <Sparkles className="h-3 w-3" />;
    className = "text-amber-400 border-amber-500/40";
    label = "Inféré";
  } else if (confidence < 0.5) {
    icon = <AlertCircle className="h-3 w-3" />;
    className = "text-destructive border-destructive/40";
    label = "Faible confiance";
  } else if (sourceName) {
    label = "Extrait";
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={variant}
            className={`gap-1 cursor-help text-[10px] px-1.5 py-0 ${className}`}
          >
            {icon}
            {!compact && <span>{label}</span>}
            {!compact && confidencePct > 0 && (
              <span className="opacity-70">· {confidencePct}%</span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm space-y-1">
          <p className="font-semibold">
            {fieldKey}{" "}
            <span className="font-normal text-muted-foreground">
              ({entityType})
            </span>
          </p>
          {sourceName ? (
            <p className="text-xs">
              📄 <span className="font-mono">{sourceName}</span>
            </p>
          ) : (
            <p className="text-xs italic text-muted-foreground">
              Aucune source liée
            </p>
          )}
          {data.source_passage && (
            <p className="text-xs italic border-l-2 border-primary/40 pl-2">
              « {data.source_passage.slice(0, 120)}
              {data.source_passage.length > 120 ? "…" : ""} »
            </p>
          )}
          <p className="text-xs">
            Confiance : <strong>{confidencePct}%</strong>{" "}
            {isInferred && (
              <span className="text-amber-400">(inféré par IA)</span>
            )}
          </p>
          <p className="text-xs">
            État :{" "}
            {isApproved ? (
              <span className="text-emerald-400">Approuvé</span>
            ) : (
              <span className="text-muted-foreground">En attente</span>
            )}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
