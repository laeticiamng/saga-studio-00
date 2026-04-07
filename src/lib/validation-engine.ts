/**
 * Validation Engine — Multi-pass asset validation orchestrator.
 */

import { supabase } from "@/integrations/supabase/client";
import type { ValidationScores, ValidationStatus } from "./aberration-taxonomy";
import { computeFinalScore, deriveValidationStatus } from "./aberration-taxonomy";
import type { AberrationSeverity } from "./aberration-taxonomy";

export interface ValidationRequest {
  projectId: string;
  assetId?: string;
  episodeShotId?: string;
  sceneId?: string;
  assetType: "image" | "video" | "clip";
  assetUrl?: string;
  prompt?: string;
  sceneDescription?: string;
}

export interface ValidationResult {
  validationId: string;
  status: ValidationStatus;
  scores: ValidationScores;
  blocking: boolean;
  anomalyCount: number;
  explanation: string;
}

/**
 * Trigger server-side validation via edge function.
 * Creates a validation record in pending state, then calls the validate-asset function.
 */
export async function requestValidation(
  req: ValidationRequest
): Promise<{ validationId: string } | null> {
  // Create pending validation record
  const { data: validation, error } = await supabase
    .from("asset_validations")
    .insert({
      project_id: req.projectId,
      asset_id: req.assetId,
      episode_shot_id: req.episodeShotId,
      scene_id: req.sceneId,
      asset_type: req.assetType,
      validation_status: "pending",
      validator_type: "ai_judge",
    })
    .select("id")
    .single();

  if (error || !validation) return null;

  // Invoke edge function (fire-and-forget style)
  supabase.functions.invoke("validate-asset", {
    body: {
      validation_id: validation.id,
      project_id: req.projectId,
      asset_id: req.assetId,
      episode_shot_id: req.episodeShotId,
      asset_type: req.assetType,
      asset_url: req.assetUrl,
      prompt: req.prompt,
      scene_description: req.sceneDescription,
    },
  });

  return { validationId: validation.id };
}

/**
 * Check if an asset is cleared for downstream use.
 */
export async function isAssetCleared(validationId: string): Promise<boolean> {
  const { data } = await supabase
    .from("asset_validations")
    .select("validation_status, blocking")
    .eq("id", validationId)
    .single();

  if (!data) return false;
  return data.validation_status === "passed" && !data.blocking;
}

/**
 * Get project-level anomaly summary.
 */
export async function getProjectAnomalySummary(projectId: string) {
  const { data: validations } = await supabase
    .from("asset_validations")
    .select("id, validation_status, blocking, scores")
    .eq("project_id", projectId);

  if (!validations) return { total: 0, passed: 0, failed: 0, blocked: 0, pending: 0 };

  return {
    total: validations.length,
    passed: validations.filter((v) => v.validation_status === "passed").length,
    failed: validations.filter((v) => v.validation_status === "failed").length,
    blocked: validations.filter((v) => v.validation_status === "blocked" || v.blocking).length,
    pending: validations.filter((v) => v.validation_status === "pending" || v.validation_status === "running").length,
  };
}
