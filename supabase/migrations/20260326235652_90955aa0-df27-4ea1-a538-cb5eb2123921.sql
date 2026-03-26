
-- ========================================
-- Workflow orchestration tables
-- ========================================

-- 1. workflow_runs: tracks a full autopilot run for an episode
CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID REFERENCES public.episodes(id) ON DELETE CASCADE,
  series_id UUID REFERENCES public.series(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  current_step_key TEXT,
  correlation_id TEXT,
  idempotency_key TEXT UNIQUE,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_episode ON public.workflow_runs(episode_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON public.workflow_runs(status);

ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workflow runs" ON public.workflow_runs
  FOR SELECT TO authenticated
  USING (
    episode_id IN (
      SELECT e.id FROM public.episodes e
      JOIN public.seasons s ON s.id = e.season_id
      JOIN public.series sr ON sr.id = s.series_id
      JOIN public.projects p ON p.id = sr.project_id
      WHERE p.user_id = auth.uid()
    )
  );

-- 2. workflow_steps: individual steps within a workflow run
CREATE TABLE IF NOT EXISTS public.workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_run_id UUID NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  step_order INT NOT NULL DEFAULT 0,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  agents TEXT[],
  requires_approval BOOLEAN DEFAULT false,
  auto_advance_threshold NUMERIC,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_run ON public.workflow_steps(workflow_run_id);

ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workflow steps" ON public.workflow_steps
  FOR SELECT TO authenticated
  USING (
    workflow_run_id IN (SELECT id FROM public.workflow_runs WHERE episode_id IN (
      SELECT e.id FROM public.episodes e
      JOIN public.seasons s ON s.id = e.season_id
      JOIN public.series sr ON sr.id = s.series_id
      JOIN public.projects p ON p.id = sr.project_id
      WHERE p.user_id = auth.uid()
    ))
  );

-- 3. workflow_step_runs: links workflow_steps to agent_runs
CREATE TABLE IF NOT EXISTS public.workflow_step_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_step_id UUID NOT NULL REFERENCES public.workflow_steps(id) ON DELETE CASCADE,
  agent_run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_step_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own step runs" ON public.workflow_step_runs
  FOR SELECT TO authenticated
  USING (
    workflow_step_id IN (SELECT id FROM public.workflow_steps WHERE workflow_run_id IN (
      SELECT id FROM public.workflow_runs WHERE episode_id IN (
        SELECT e.id FROM public.episodes e
        JOIN public.seasons s ON s.id = e.season_id
        JOIN public.series sr ON sr.id = s.series_id
        JOIN public.projects p ON p.id = sr.project_id
        WHERE p.user_id = auth.uid()
      )
    ))
  );

-- 4. workflow_approvals: approval decisions per workflow step
CREATE TABLE IF NOT EXISTS public.workflow_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_step_id UUID NOT NULL REFERENCES public.workflow_steps(id) ON DELETE CASCADE,
  decision TEXT NOT NULL DEFAULT 'pending',
  decided_by_user UUID,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own approvals" ON public.workflow_approvals
  FOR SELECT TO authenticated
  USING (
    workflow_step_id IN (SELECT id FROM public.workflow_steps WHERE workflow_run_id IN (
      SELECT id FROM public.workflow_runs WHERE episode_id IN (
        SELECT e.id FROM public.episodes e
        JOIN public.seasons s ON s.id = e.season_id
        JOIN public.series sr ON sr.id = s.series_id
        JOIN public.projects p ON p.id = sr.project_id
        WHERE p.user_id = auth.uid()
      )
    ))
  );

-- 5. workflow_confidence_scores: confidence scores per dimension
CREATE TABLE IF NOT EXISTS public.workflow_confidence_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_step_id UUID REFERENCES public.workflow_steps(id) ON DELETE SET NULL,
  agent_run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  episode_id UUID REFERENCES public.episodes(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wf_confidence_episode ON public.workflow_confidence_scores(episode_id);

ALTER TABLE public.workflow_confidence_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own confidence scores" ON public.workflow_confidence_scores
  FOR SELECT TO authenticated
  USING (
    episode_id IN (
      SELECT e.id FROM public.episodes e
      JOIN public.seasons s ON s.id = e.season_id
      JOIN public.series sr ON sr.id = s.series_id
      JOIN public.projects p ON p.id = sr.project_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Add unique constraint on delivery_manifests for upsert in delivery-qc
CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_manifests_series_episode
  ON public.delivery_manifests(series_id, episode_id)
  WHERE episode_id IS NOT NULL;

-- Add updated_at trigger for workflow_runs
CREATE TRIGGER update_workflow_runs_updated_at
  BEFORE UPDATE ON public.workflow_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
