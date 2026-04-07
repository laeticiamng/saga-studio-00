import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RetrievalScope = "scene" | "episode" | "character" | "project" | "timeline" | "continuity";

interface RetrievalContext {
  project_canon: Record<string, Record<string, unknown>>;
  entities: Array<{
    type: string;
    key: string;
    value: unknown;
    confidence: number;
    source_passage?: string;
  }>;
  continuity_rules: Array<{ rule: unknown; key: string; confidence: number }>;
  style_references: Array<{ type: string; key: string; value: unknown }>;
}

interface RetrievalResult {
  scope: RetrievalScope;
  scope_id?: string;
  context: RetrievalContext;
  entities_included: number;
  token_estimate: number;
}

/**
 * Retrieve contextual project knowledge for generation.
 * Queries canonical fields + extracted entities filtered by scope.
 */
export function useProjectContext(
  projectId: string | undefined,
  scope: RetrievalScope,
  scopeId?: string,
  entityTypes?: string[],
  enabled = true
) {
  return useQuery<RetrievalResult>({
    queryKey: ["project_context", projectId, scope, scopeId, entityTypes],
    enabled: !!projectId && enabled,
    staleTime: 60_000, // Cache for 1 min
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("import-document", {
        body: {
          action: "retrieve_context",
          project_id: projectId,
          scope,
          scope_id: scopeId,
          entity_types: entityTypes,
        },
      });
      if (error) throw error;
      return data as RetrievalResult;
    },
  });
}

/**
 * On-demand context retrieval (for generation jobs).
 */
export function useRetrieveContext() {
  return useMutation<RetrievalResult, Error, {
    projectId: string;
    scope: RetrievalScope;
    scopeId?: string;
    entityTypes?: string[];
    maxTokens?: number;
  }>({
    mutationFn: async ({ projectId, scope, scopeId, entityTypes, maxTokens }) => {
      const { data, error } = await supabase.functions.invoke("import-document", {
        body: {
          action: "retrieve_context",
          project_id: projectId,
          scope,
          scope_id: scopeId,
          entity_types: entityTypes,
          max_tokens: maxTokens,
        },
      });
      if (error) throw error;
      return data as RetrievalResult;
    },
  });
}

/**
 * Get knowledge graph summary: entity counts by type for a project.
 */
export function useProjectKnowledgeGraph(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project_knowledge_graph", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      // Canonical fields summary
      const { data: fields } = await supabase
        .from("canonical_fields")
        .select("entity_type, approved, confidence")
        .eq("project_id", projectId!);

      // Entity counts from documents
      const { data: docs } = await supabase
        .from("source_documents")
        .select("id, document_role, source_priority")
        .eq("project_id", projectId!)
        .neq("source_priority", "deprecated");

      const docIds = (docs || []).map(d => d.id);
      const { data: entities } = await supabase
        .from("source_document_entities")
        .select("entity_type, extraction_confidence, status")
        .in("document_id", docIds.length > 0 ? docIds : ["none"]);

      // Conflicts
      const { data: conflicts } = await supabase
        .from("canonical_conflicts")
        .select("id, resolution")
        .eq("project_id", projectId!);

      // Inferred
      const { data: inferred } = await supabase
        .from("inferred_completions")
        .select("id, status")
        .eq("project_id", projectId!);

      // Build summary
      const entityCounts: Record<string, number> = {};
      for (const e of entities || []) {
        entityCounts[e.entity_type] = (entityCounts[e.entity_type] || 0) + 1;
      }

      const canonicalByType: Record<string, number> = {};
      for (const f of fields || []) {
        canonicalByType[f.entity_type] = (canonicalByType[f.entity_type] || 0) + 1;
      }

      return {
        documents_count: docs?.length || 0,
        documents_by_role: Object.entries(
          (docs || []).reduce((acc: Record<string, number>, d) => {
            acc[d.document_role || "unknown"] = (acc[d.document_role || "unknown"] || 0) + 1;
            return acc;
          }, {})
        ),
        total_entities: entities?.length || 0,
        entities_by_type: entityCounts,
        canonical_fields: fields?.length || 0,
        canonical_approved: fields?.filter(f => f.approved).length || 0,
        canonical_by_type: canonicalByType,
        conflicts_total: conflicts?.length || 0,
        conflicts_unresolved: conflicts?.filter(c => !c.resolution || c.resolution === "unresolved").length || 0,
        inferred_total: inferred?.length || 0,
        inferred_pending: inferred?.filter(i => i.status === "proposed").length || 0,
      };
    },
  });
}
