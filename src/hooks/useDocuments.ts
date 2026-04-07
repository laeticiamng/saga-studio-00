import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ——— Source Documents ———

export function useSourceDocuments(seriesId: string | undefined, projectId?: string) {
  return useQuery({
    queryKey: ["source_documents", seriesId, projectId],
    enabled: !!(seriesId || projectId),
    queryFn: async () => {
      let query = supabase.from("source_documents").select("*").order("created_at", { ascending: false });
      if (seriesId) query = query.eq("series_id", seriesId);
      else if (projectId) query = query.eq("project_id", projectId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useDocumentEntities(documentId: string | undefined) {
  return useQuery({
    queryKey: ["document_entities", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("source_document_entities")
        .select("*, mappings:source_document_mappings(*)")
        .eq("document_id", documentId!)
        .order("entity_type", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useDocumentChunks(documentId: string | undefined) {
  return useQuery({
    queryKey: ["document_chunks", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("source_document_chunks")
        .select("*")
        .eq("document_id", documentId!)
        .order("chunk_index");
      if (error) throw error;
      return data;
    },
  });
}

export function useAutofillRuns(documentId: string | undefined) {
  return useQuery({
    queryKey: ["autofill_runs", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("source_document_autofill_runs")
        .select("*")
        .eq("document_id", documentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ——— Upload (single file) ———

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, seriesId, projectId }: { file: File; seriesId?: string; projectId?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const storagePath = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("source-documents")
        .upload(storagePath, file);
      if (uploadErr) throw uploadErr;

      const { data, error } = await supabase.functions.invoke("import-document", {
        body: {
          file_name: file.name,
          file_type: file.type,
          file_size_bytes: file.size,
          storage_path: storagePath,
          series_id: seriesId || null,
          project_id: projectId || null,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["source_documents"] });
    },
  });
}

// ——— Batch upload (multiple files) ———

export function useBatchUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      files,
      seriesId,
      projectId,
      onProgress,
    }: {
      files: File[];
      seriesId?: string;
      projectId?: string;
      onProgress?: (done: number, total: number) => void;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const documentIds: string[] = [];

      // Upload all files to storage first
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const storagePath = `${user.id}/${Date.now()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage
          .from("source-documents")
          .upload(storagePath, file);
        if (uploadErr) throw uploadErr;

        // Register document
        const { data, error } = await supabase.functions.invoke("import-document", {
          body: {
            file_name: file.name,
            file_type: file.type,
            file_size_bytes: file.size,
            storage_path: storagePath,
            series_id: seriesId || null,
            project_id: projectId || null,
          },
        });
        if (error) throw error;
        if (data?.document_id) documentIds.push(data.document_id);
        onProgress?.(i + 1, files.length);
      }

      return { documentIds, count: documentIds.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["source_documents"] });
      queryClient.invalidateQueries({ queryKey: ["canonical_conflicts"] });
      queryClient.invalidateQueries({ queryKey: ["canonical_fields"] });
      queryClient.invalidateQueries({ queryKey: ["inferred_completions"] });
    },
  });
}

// ——— Reprocess single document ———

export function useReprocessDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ documentId }: { documentId: string }) => {
      const { data, error } = await supabase.functions.invoke("import-document", {
        body: { action: "reprocess", document_id: documentId },
      });
      if (error) throw error;
      return data;
    },
    // Optimistic update: immediately show reprocessing state
    onMutate: async ({ documentId }) => {
      await queryClient.cancelQueries({ queryKey: ["source_documents"] });
      const previous = queryClient.getQueriesData({ queryKey: ["source_documents"] });

      queryClient.setQueriesData(
        { queryKey: ["source_documents"] },
        (old: Array<Record<string, unknown>> | undefined) => {
          if (!old) return old;
          return old.map((doc) =>
            doc.id === documentId
              ? { ...doc, status: "reprocessing", extraction_mode: null }
              : doc
          );
        }
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["source_documents"] });
      queryClient.invalidateQueries({ queryKey: ["document_entities"] });
      queryClient.invalidateQueries({ queryKey: ["document_chunks"] });
      queryClient.invalidateQueries({ queryKey: ["autofill_runs"] });
      queryClient.invalidateQueries({ queryKey: ["canonical_fields"] });
      queryClient.invalidateQueries({ queryKey: ["canonical_conflicts"] });
    },
  });
}

// ——— Reprocess all legacy documents ———

/** Legacy extraction modes from older parser versions */
const LEGACY_EXTRACTION_MODES = ["pdf_vision_api_error", "pdf_vision_api", "vision_api", "pdf_vision"];

function isLegacyDoc(doc: Record<string, unknown>): boolean {
  const mode = doc.extraction_mode as string | null;
  if (!mode) return false;
  if (LEGACY_EXTRACTION_MODES.some(m => mode === m || mode.startsWith(m))) return true;
  const meta = doc.metadata as Record<string, unknown> | null;
  const debug = meta?.extraction_debug as Record<string, unknown> | undefined;
  if (debug && !debug.parser_version) return true;
  return false;
}

export function useReprocessLegacyDocuments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      seriesId,
      documentIds,
    }: {
      projectId?: string;
      seriesId?: string;
      documentIds?: string[];
    }) => {
      const { data, error } = await supabase.functions.invoke("import-document", {
        body: {
          action: "reprocess_legacy",
          project_id: projectId || null,
          series_id: seriesId || null,
          document_ids: documentIds || null,
        },
      });
      if (error) throw error;
      return data;
    },
    // Optimistic update: mark all legacy docs as reprocessing
    onMutate: async ({ documentIds }) => {
      await queryClient.cancelQueries({ queryKey: ["source_documents"] });
      const previous = queryClient.getQueriesData({ queryKey: ["source_documents"] });

      queryClient.setQueriesData(
        { queryKey: ["source_documents"] },
        (old: Array<Record<string, unknown>> | undefined) => {
          if (!old) return old;
          return old.map((doc) => {
            const shouldUpdate = documentIds
              ? documentIds.includes(doc.id as string)
              : isLegacyDoc(doc);
            return shouldUpdate
              ? { ...doc, status: "reprocessing", extraction_mode: null }
              : doc;
          });
        }
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["source_documents"] });
      queryClient.invalidateQueries({ queryKey: ["document_entities"] });
      queryClient.invalidateQueries({ queryKey: ["document_chunks"] });
      queryClient.invalidateQueries({ queryKey: ["autofill_runs"] });
      queryClient.invalidateQueries({ queryKey: ["canonical_fields"] });
      queryClient.invalidateQueries({ queryKey: ["canonical_conflicts"] });
      queryClient.invalidateQueries({ queryKey: ["inferred_completions"] });
    },
  });
}

// ——— Mapping actions ———

export function useUpdateMapping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "accepted" | "rejected" | "modified" }) => {
      const { data, error } = await supabase
        .from("source_document_mappings")
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document_entities"] });
    },
  });
}

// ——— Document role + priority ———

export function useUpdateDocumentRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, document_role }: { id: string; document_role: string }) => {
      const { data, error } = await supabase
        .from("source_documents")
        .update({ document_role, role_confidence: 1 } as Record<string, unknown>)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["source_documents"] });
    },
  });
}

export function useUpdateSourcePriority() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, source_priority }: { id: string; source_priority: string }) => {
      const { data, error } = await supabase
        .from("source_documents")
        .update({ source_priority } as Record<string, unknown>)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["source_documents"] });
    },
  });
}

// ——— Canonical Conflicts ———

export function useCanonicalConflicts(projectId: string | undefined) {
  return useQuery({
    queryKey: ["canonical_conflicts", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("canonical_conflicts")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useResolveConflict() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      canonical_value,
      resolution,
    }: {
      id: string;
      canonical_value: unknown;
      resolution: "resolved_a" | "resolved_b" | "resolved_manual";
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("canonical_conflicts")
        .update({
          canonical_value: canonical_value as unknown as import("@/integrations/supabase/types").Json,
          resolution,
          resolved_by: user?.id,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canonical_conflicts"] });
      queryClient.invalidateQueries({ queryKey: ["canonical_fields"] });
    },
  });
}

// ——— Canonical Fields ———

export function useCanonicalFields(projectId: string | undefined) {
  return useQuery({
    queryKey: ["canonical_fields", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("canonical_fields")
        .select("*")
        .eq("project_id", projectId!)
        .order("entity_type", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useApproveCanonicalField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("canonical_fields")
        .update({
          approved: true,
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canonical_fields"] });
    },
  });
}

// ——— Inferred Completions ———

export function useInferredCompletions(projectId: string | undefined) {
  return useQuery({
    queryKey: ["inferred_completions", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inferred_completions")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useReviewInferredCompletion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "accepted" | "rejected" }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("inferred_completions")
        .update({
          status,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inferred_completions"] });
    },
  });
}

// ——— Ingestion Runs ———

export function useIngestionRuns(projectId: string | undefined) {
  return useQuery({
    queryKey: ["ingestion_runs", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ingestion_runs")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ——— Trigger conflict + missing detection ———

export function useDetectConflicts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId }: { projectId: string }) => {
      const { data, error } = await supabase.functions.invoke("import-document", {
        body: { action: "detect_conflicts", project_id: projectId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canonical_conflicts"] });
    },
  });
}

export function useDetectMissing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId }: { projectId: string }) => {
      const { data, error } = await supabase.functions.invoke("import-document", {
        body: { action: "detect_missing", project_id: projectId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inferred_completions"] });
    },
  });
}
