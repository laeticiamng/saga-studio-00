import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { requestValidation, type ValidationRequest } from "@/lib/validation-engine";
import { toast } from "sonner";

// ─── Asset Validations ────────────────────────────────────────────

export function useAssetValidations(projectId?: string) {
  return useQuery({
    queryKey: ["asset-validations", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_validations")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });
}

export function useAssetValidation(validationId?: string) {
  return useQuery({
    queryKey: ["asset-validation", validationId],
    enabled: !!validationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_validations")
        .select("*")
        .eq("id", validationId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

// ─── Anomaly Events ──────────────────────────────────────────────

export function useAnomalyEvents(validationId?: string) {
  return useQuery({
    queryKey: ["anomaly-events", validationId],
    enabled: !!validationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("anomaly_events")
        .select("*")
        .eq("validation_id", validationId!)
        .order("severity", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useProjectAnomalyEvents(projectId?: string) {
  return useQuery({
    queryKey: ["project-anomaly-events", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data: validations } = await supabase
        .from("asset_validations")
        .select("id")
        .eq("project_id", projectId!);
      if (!validations?.length) return [];
      const ids = validations.map((v) => v.id);
      const { data, error } = await supabase
        .from("anomaly_events")
        .select("*")
        .in("validation_id", ids)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });
}

// ─── Repair Attempts ─────────────────────────────────────────────

export function useRepairAttempts(anomalyEventId?: string) {
  return useQuery({
    queryKey: ["repair-attempts", anomalyEventId],
    enabled: !!anomalyEventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repair_attempts")
        .select("*")
        .eq("anomaly_event_id", anomalyEventId!)
        .order("attempt_number");
      if (error) throw error;
      return data;
    },
  });
}

// ─── Project Validation Reports ──────────────────────────────────

export function useProjectValidationReport(projectId?: string) {
  return useQuery({
    queryKey: ["project-validation-report", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_validation_reports")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// ─── Aberration Categories ───────────────────────────────────────

export function useAberrationCategories() {
  return useQuery({
    queryKey: ["aberration-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aberration_categories")
        .select("*")
        .order("category");
      if (error) throw error;
      return data;
    },
    staleTime: 300_000,
  });
}

// ─── Trigger Validation ──────────────────────────────────────────

export function useRequestValidation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (req: ValidationRequest) => {
      const result = await requestValidation(req);
      if (!result) throw new Error("Failed to create validation");
      return result;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["asset-validations", vars.projectId] });
      toast.success("Validation lancée");
    },
    onError: () => {
      toast.error("Erreur lors du lancement de la validation");
    },
  });
}
