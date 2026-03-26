import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSourceDocuments(seriesId: string | undefined, projectId?: string) {
  return useQuery({
    queryKey: ["source_documents", seriesId, projectId],
    enabled: !!(seriesId || projectId),
    queryFn: async () => {
      let query = (supabase as any).from("source_documents").select("*").order("created_at", { ascending: false });
      if (seriesId) query = query.eq("series_id", seriesId);
      else if (projectId) query = query.eq("project_id", projectId);
      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useDocumentEntities(documentId: string | undefined) {
  return useQuery({
    queryKey: ["document_entities", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("source_document_entities")
        .select("*, mappings:source_document_mappings(*)")
        .eq("document_id", documentId!)
        .order("entity_type", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useDocumentChunks(documentId: string | undefined) {
  return useQuery({
    queryKey: ["document_chunks", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("source_document_chunks")
        .select("*")
        .eq("document_id", documentId!)
        .order("chunk_index");
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useAutofillRuns(documentId: string | undefined) {
  return useQuery({
    queryKey: ["autofill_runs", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("source_document_autofill_runs")
        .select("*")
        .eq("document_id", documentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, seriesId, projectId }: { file: File; seriesId?: string; projectId?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload file to storage
      const storagePath = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("source-documents")
        .upload(storagePath, file);
      if (uploadErr) throw uploadErr;

      // Register and process
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

export function useUpdateMapping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "accepted" | "rejected" | "modified" }) => {
      const { data, error } = await (supabase as any)
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
