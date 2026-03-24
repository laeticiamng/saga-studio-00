-- Migration: Workflow orchestration, confidence scoring, continuity memory,
-- redaction/compliance, delivery QC, provider hardening, export jobs.
-- Incremental: does NOT touch existing tables except adding columns.

-- ============================================================
-- 1. WORKFLOW ORCHESTRATION
-- ============================================================

-- Workflow templates define reusable pipeline shapes
CREATE TABLE IF NOT EXISTS public.workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]',
  default_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read workflow templates" ON public.workflow_templates FOR SELECT USING (true);
CREATE POLICY "Admins manage workflow templates" ON public.workflow_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Seed the default series episode workflow
INSERT INTO public.workflow_templates (name, description, steps) VALUES
('series_episode_default', 'Default series episode production pipeline', '[
  {"order":1,"key":"story_development","label":"Story Development","agents":["story_architect","scriptwriter"],"requires_approval":false,"auto_advance":true},
  {"order":2,"key":"psychology_review","label":"Psychology Review","agents":["psychology_reviewer"],"requires_approval":true,"auto_advance_threshold":0.85},
  {"order":3,"key":"legal_ethics_review","label":"Legal/Ethics Review","agents":["legal_ethics_reviewer"],"requires_approval":true,"auto_advance_threshold":0.90},
  {"order":4,"key":"visual_bible","label":"Visual Bible","agents":["visual_director"],"requires_approval":false,"auto_advance":true},
  {"order":5,"key":"continuity_check","label":"Continuity Check","agents":["continuity_checker"],"requires_approval":true,"auto_advance_threshold":0.90},
  {"order":6,"key":"shot_generation","label":"Shot Generation","agents":["scene_designer","shot_planner"],"requires_approval":false,"auto_advance":true},
  {"order":7,"key":"shot_review","label":"Shot Review","agents":["qa_reviewer"],"requires_approval":true,"auto_advance_threshold":0.80},
  {"order":8,"key":"assembly","label":"Assembly","agents":["editor"],"requires_approval":false,"auto_advance":true},
  {"order":9,"key":"edit_review","label":"Edit Review","agents":["qa_reviewer"],"requires_approval":true,"auto_advance_threshold":0.85},
  {"order":10,"key":"delivery","label":"Delivery","agents":["delivery_manager"],"requires_approval":false,"auto_advance":true}
]')
ON CONFLICT (name) DO NOTHING;

-- Workflow runs track a specific execution of a template
CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.workflow_templates(id) ON DELETE SET NULL,
  episode_id UUID REFERENCES public.episodes(id) ON DELETE CASCADE,
  series_id UUID REFERENCES public.series(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','paused','completed','failed','cancelled')),
  current_step_key TEXT,
  config JSONB DEFAULT '{}',
  idempotency_key TEXT UNIQUE,
  correlation_id UUID DEFAULT gen_random_uuid(),
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own workflow runs" ON public.workflow_runs
  FOR SELECT TO authenticated
  USING (
    series_id IS NULL OR EXISTS (
      SELECT 1 FROM public.series s JOIN public.projects p ON p.id = s.project_id
      WHERE s.id = workflow_runs.series_id
        AND (p.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
    )
  );
CREATE POLICY "System can manage workflow runs" ON public.workflow_runs
  FOR ALL TO authenticated WITH CHECK (true);

CREATE INDEX idx_workflow_runs_episode ON public.workflow_runs(episode_id);
CREATE INDEX idx_workflow_runs_series ON public.workflow_runs(series_id);
CREATE INDEX idx_workflow_runs_status ON public.workflow_runs(status);
CREATE INDEX idx_workflow_runs_idempotency ON public.workflow_runs(idempotency_key);

CREATE TRIGGER update_workflow_runs_updated_at
  BEFORE UPDATE ON public.workflow_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Workflow steps persist each step execution within a run
CREATE TABLE IF NOT EXISTS public.workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_run_id UUID NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','waiting_approval','approved','rejected','skipped','completed','failed')),
  agents TEXT[] DEFAULT '{}',
  requires_approval BOOLEAN DEFAULT false,
  auto_advance_threshold NUMERIC(4,2),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own workflow steps" ON public.workflow_steps
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.workflow_runs wr WHERE wr.id = workflow_steps.workflow_run_id
      AND (wr.series_id IS NULL OR EXISTS (
        SELECT 1 FROM public.series s JOIN public.projects p ON p.id = s.project_id
        WHERE s.id = wr.series_id
          AND (p.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
      ))
  ));
CREATE POLICY "System can manage workflow steps" ON public.workflow_steps
  FOR ALL TO authenticated WITH CHECK (true);

CREATE INDEX idx_workflow_steps_run ON public.workflow_steps(workflow_run_id);

CREATE TRIGGER update_workflow_steps_updated_at
  BEFORE UPDATE ON public.workflow_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Workflow step runs link agent_runs to workflow steps
CREATE TABLE IF NOT EXISTS public.workflow_step_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_step_id UUID NOT NULL REFERENCES public.workflow_steps(id) ON DELETE CASCADE,
  agent_run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_step_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view workflow step runs" ON public.workflow_step_runs
  FOR SELECT TO authenticated USING (true);

-- Workflow approvals link approval decisions to workflow steps
CREATE TABLE IF NOT EXISTS public.workflow_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_step_id UUID NOT NULL REFERENCES public.workflow_steps(id) ON DELETE CASCADE,
  approval_step_id UUID REFERENCES public.approval_steps(id) ON DELETE SET NULL,
  decision TEXT CHECK (decision IN ('pending','approved','rejected','revision_requested')) DEFAULT 'pending',
  decided_by_user UUID,
  decided_by_agent TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own workflow approvals" ON public.workflow_approvals
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage own workflow approvals" ON public.workflow_approvals
  FOR ALL TO authenticated WITH CHECK (true);

CREATE INDEX idx_workflow_approvals_step ON public.workflow_approvals(workflow_step_id);

-- ============================================================
-- 2. CONFIDENCE SCORING
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workflow_confidence_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_step_id UUID REFERENCES public.workflow_steps(id) ON DELETE CASCADE,
  agent_run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  episode_id UUID REFERENCES public.episodes(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,
  score NUMERIC(5,4) NOT NULL CHECK (score >= 0 AND score <= 1),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_confidence_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own confidence scores" ON public.workflow_confidence_scores
  FOR SELECT TO authenticated
  USING (
    episode_id IS NULL OR EXISTS (
      SELECT 1 FROM public.episodes e
      JOIN public.seasons sn ON sn.id = e.season_id
      JOIN public.series s ON s.id = sn.series_id
      JOIN public.projects p ON p.id = s.project_id
      WHERE e.id = workflow_confidence_scores.episode_id
        AND (p.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
    )
  );
CREATE POLICY "System can insert confidence scores" ON public.workflow_confidence_scores
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_confidence_scores_episode ON public.workflow_confidence_scores(episode_id);
CREATE INDEX idx_confidence_scores_step ON public.workflow_confidence_scores(workflow_step_id);

-- ============================================================
-- 3. CONTINUITY MEMORY GRAPH
-- ============================================================

CREATE TABLE IF NOT EXISTS public.continuity_memory_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL CHECK (node_type IN ('character','location','prop','costume','event','relationship','visual_style','music_theme')),
  label TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}',
  first_appearance_episode UUID REFERENCES public.episodes(id) ON DELETE SET NULL,
  last_updated_episode UUID REFERENCES public.episodes(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.continuity_memory_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own continuity nodes" ON public.continuity_memory_nodes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.series s JOIN public.projects p ON p.id = s.project_id
    WHERE s.id = continuity_memory_nodes.series_id
      AND (p.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  ));
CREATE POLICY "System can manage continuity nodes" ON public.continuity_memory_nodes
  FOR ALL TO authenticated WITH CHECK (true);

CREATE INDEX idx_continuity_nodes_series ON public.continuity_memory_nodes(series_id);
CREATE INDEX idx_continuity_nodes_type ON public.continuity_memory_nodes(node_type);

CREATE TRIGGER update_continuity_nodes_updated_at
  BEFORE UPDATE ON public.continuity_memory_nodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.continuity_memory_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES public.continuity_memory_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES public.continuity_memory_nodes(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL CHECK (edge_type IN ('interacts_with','wears','located_at','owns','transforms_to','conflicts_with','depends_on')),
  properties JSONB DEFAULT '{}',
  valid_from_episode UUID REFERENCES public.episodes(id) ON DELETE SET NULL,
  valid_until_episode UUID REFERENCES public.episodes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.continuity_memory_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own continuity edges" ON public.continuity_memory_edges
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.series s JOIN public.projects p ON p.id = s.project_id
    WHERE s.id = continuity_memory_edges.series_id
      AND (p.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  ));
CREATE POLICY "System can manage continuity edges" ON public.continuity_memory_edges
  FOR ALL TO authenticated WITH CHECK (true);

CREATE INDEX idx_continuity_edges_series ON public.continuity_memory_edges(series_id);
CREATE INDEX idx_continuity_edges_source ON public.continuity_memory_edges(source_node_id);
CREATE INDEX idx_continuity_edges_target ON public.continuity_memory_edges(target_node_id);

-- Continuity conflicts (detected issues)
CREATE TABLE IF NOT EXISTS public.continuity_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES public.episodes(id) ON DELETE SET NULL,
  continuity_report_id UUID REFERENCES public.continuity_reports(id) ON DELETE SET NULL,
  conflict_type TEXT NOT NULL CHECK (conflict_type IN ('character_appearance','costume_change','prop_inconsistency','location_error','timeline_error','dialogue_contradiction','visual_mismatch')),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','error','critical')),
  description TEXT NOT NULL,
  node_ids UUID[] DEFAULT '{}',
  resolved BOOLEAN DEFAULT false,
  resolved_by TEXT,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.continuity_conflicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own continuity conflicts" ON public.continuity_conflicts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.series s JOIN public.projects p ON p.id = s.project_id
    WHERE s.id = continuity_conflicts.series_id
      AND (p.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  ));
CREATE POLICY "Users can manage own continuity conflicts" ON public.continuity_conflicts
  FOR ALL TO authenticated WITH CHECK (true);

CREATE INDEX idx_continuity_conflicts_series ON public.continuity_conflicts(series_id);
CREATE INDEX idx_continuity_conflicts_episode ON public.continuity_conflicts(episode_id);

-- ============================================================
-- 4. REDACTION / COMPLIANCE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.redaction_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  rules JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.redaction_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own redaction profiles" ON public.redaction_profiles
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.series s JOIN public.projects p ON p.id = s.project_id
    WHERE s.id = redaction_profiles.series_id
      AND (p.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  ));
CREATE POLICY "Users can manage own redaction profiles" ON public.redaction_profiles
  FOR ALL TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.redaction_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.redaction_profiles(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('blur_face','blur_region','mute_audio','replace_text','block_content','age_gate')),
  target_pattern TEXT,
  config JSONB DEFAULT '{}',
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.redaction_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own redaction rules" ON public.redaction_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage own redaction rules" ON public.redaction_rules
  FOR ALL TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.redaction_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.redaction_profiles(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES public.episodes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  applied_rules JSONB DEFAULT '[]',
  issues_found INTEGER DEFAULT 0,
  issues_resolved INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.redaction_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own redaction runs" ON public.redaction_runs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can manage redaction runs" ON public.redaction_runs
  FOR ALL TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.redaction_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  redaction_run_id UUID NOT NULL REFERENCES public.redaction_runs(id) ON DELETE CASCADE,
  findings JSONB NOT NULL DEFAULT '[]',
  verdict TEXT NOT NULL CHECK (verdict IN ('pass','fail','partial')),
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.redaction_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own redaction reports" ON public.redaction_reports
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 5. DELIVERY / QC / EXPORT
-- ============================================================

CREATE TABLE IF NOT EXISTS public.delivery_manifests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES public.episodes(id) ON DELETE SET NULL,
  season_id UUID REFERENCES public.seasons(id) ON DELETE SET NULL,
  manifest_type TEXT NOT NULL DEFAULT 'episode' CHECK (manifest_type IN ('episode','season','series')),
  assets JSONB NOT NULL DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_qc','qc_passed','qc_failed','delivered','archived')),
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_manifests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own delivery manifests" ON public.delivery_manifests
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.series s JOIN public.projects p ON p.id = s.project_id
    WHERE s.id = delivery_manifests.series_id
      AND (p.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  ));
CREATE POLICY "Users can manage own delivery manifests" ON public.delivery_manifests
  FOR ALL TO authenticated WITH CHECK (true);

CREATE INDEX idx_delivery_manifests_series ON public.delivery_manifests(series_id);
CREATE INDEX idx_delivery_manifests_episode ON public.delivery_manifests(episode_id);

CREATE TRIGGER update_delivery_manifests_updated_at
  BEFORE UPDATE ON public.delivery_manifests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.qc_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_manifest_id UUID REFERENCES public.delivery_manifests(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES public.episodes(id) ON DELETE SET NULL,
  checks JSONB NOT NULL DEFAULT '[]',
  overall_verdict TEXT NOT NULL CHECK (overall_verdict IN ('pass','fail','conditional_pass')),
  blocking_issues JSONB DEFAULT '[]',
  warnings JSONB DEFAULT '[]',
  score NUMERIC(5,4) CHECK (score >= 0 AND score <= 1),
  checked_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.qc_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own qc reports" ON public.qc_reports
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can manage qc reports" ON public.qc_reports
  FOR ALL TO authenticated WITH CHECK (true);

CREATE INDEX idx_qc_reports_manifest ON public.qc_reports(delivery_manifest_id);
CREATE INDEX idx_qc_reports_episode ON public.qc_reports(episode_id);

CREATE TABLE IF NOT EXISTS public.export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_manifest_id UUID REFERENCES public.delivery_manifests(id) ON DELETE SET NULL,
  episode_id UUID REFERENCES public.episodes(id) ON DELETE SET NULL,
  series_id UUID REFERENCES public.series(id) ON DELETE CASCADE,
  export_type TEXT NOT NULL DEFAULT 'video' CHECK (export_type IN ('video','audio','subtitles','thumbnails','metadata','full_package')),
  format TEXT DEFAULT 'mp4',
  config JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  output_url TEXT,
  file_size_bytes BIGINT,
  idempotency_key TEXT UNIQUE,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own export jobs" ON public.export_jobs
  FOR SELECT TO authenticated
  USING (
    series_id IS NULL OR EXISTS (
      SELECT 1 FROM public.series s JOIN public.projects p ON p.id = s.project_id
      WHERE s.id = export_jobs.series_id
        AND (p.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
    )
  );
CREATE POLICY "System can manage export jobs" ON public.export_jobs
  FOR ALL TO authenticated WITH CHECK (true);

CREATE INDEX idx_export_jobs_series ON public.export_jobs(series_id);
CREATE INDEX idx_export_jobs_episode ON public.export_jobs(episode_id);
CREATE INDEX idx_export_jobs_status ON public.export_jobs(status);
CREATE INDEX idx_export_jobs_idempotency ON public.export_jobs(idempotency_key);

CREATE TRIGGER update_export_jobs_updated_at
  BEFORE UPDATE ON public.export_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 6. PROVIDER HARDENING
-- ============================================================

CREATE TABLE IF NOT EXISTS public.provider_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.provider_registry(id) ON DELETE CASCADE,
  capability TEXT NOT NULL,
  config JSONB DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.provider_capabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read provider capabilities" ON public.provider_capabilities FOR SELECT USING (true);
CREATE POLICY "Admins manage provider capabilities" ON public.provider_capabilities FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.provider_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.provider_registry(id) ON DELETE CASCADE,
  error_type TEXT NOT NULL,
  error_message TEXT,
  http_status INTEGER,
  request_context JSONB DEFAULT '{}',
  fallback_provider_id UUID REFERENCES public.provider_registry(id),
  fallback_succeeded BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.provider_failures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view provider failures" ON public.provider_failures
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert provider failures" ON public.provider_failures
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_provider_failures_provider ON public.provider_failures(provider_id);
CREATE INDEX idx_provider_failures_created ON public.provider_failures(created_at);

-- ============================================================
-- 7. AGENT OUTPUT ARTIFACTS (enhance existing table)
-- ============================================================

-- Add correlation_id to audit_logs for structured tracing
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS correlation_id UUID;
CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation ON public.audit_logs(correlation_id);

-- Add idempotency_key to agent_runs
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3;
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS correlation_id UUID;
CREATE INDEX IF NOT EXISTS idx_agent_runs_idempotency ON public.agent_runs(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_agent_runs_correlation ON public.agent_runs(correlation_id);

-- Add workflow_run_id to episodes for tracking
ALTER TABLE public.episodes ADD COLUMN IF NOT EXISTS workflow_run_id UUID REFERENCES public.workflow_runs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_episodes_workflow_run ON public.episodes(workflow_run_id);
