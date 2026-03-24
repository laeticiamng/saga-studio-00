-- Migration 4A: Review and approval tables

-- Approval steps (generic workflow)
CREATE TABLE IF NOT EXISTS public.approval_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  status public.approval_status NOT NULL DEFAULT 'pending',
  reviewer_agent TEXT REFERENCES public.agent_registry(slug),
  reviewer_user UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own approval steps" ON public.approval_steps
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.episodes e
    JOIN public.seasons sn ON sn.id = e.season_id
    JOIN public.series s ON s.id = sn.series_id
    JOIN public.projects p ON p.id = s.project_id
    WHERE e.id = approval_steps.episode_id
      AND (p.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "Users can manage own approval steps" ON public.approval_steps
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.episodes e
    JOIN public.seasons sn ON sn.id = e.season_id
    JOIN public.series s ON s.id = sn.series_id
    JOIN public.projects p ON p.id = s.project_id
    WHERE e.id = approval_steps.episode_id AND p.user_id = auth.uid()::text
  ));

CREATE INDEX idx_approval_steps_episode ON public.approval_steps(episode_id);

CREATE TRIGGER update_approval_steps_updated_at
  BEFORE UPDATE ON public.approval_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Approval decisions (audit trail)
CREATE TABLE IF NOT EXISTS public.approval_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_step_id UUID NOT NULL REFERENCES public.approval_steps(id) ON DELETE CASCADE,
  decision public.approval_status NOT NULL,
  reason TEXT,
  decided_by TEXT,
  agent_run_id UUID REFERENCES public.agent_runs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.approval_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own approval decisions" ON public.approval_decisions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.approval_steps a
    JOIN public.episodes e ON e.id = a.episode_id
    JOIN public.seasons sn ON sn.id = e.season_id
    JOIN public.series s ON s.id = sn.series_id
    JOIN public.projects p ON p.id = s.project_id
    WHERE a.id = approval_decisions.approval_step_id
      AND (p.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  ));

-- Continuity reports
CREATE TABLE IF NOT EXISTS public.continuity_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  agent_run_id UUID REFERENCES public.agent_runs(id),
  issues JSONB NOT NULL DEFAULT '[]',
  verdict public.review_verdict NOT NULL DEFAULT 'pass',
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.continuity_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own continuity reports" ON public.continuity_reports
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.episodes e
    JOIN public.seasons sn ON sn.id = e.season_id
    JOIN public.series s ON s.id = sn.series_id
    JOIN public.projects p ON p.id = s.project_id
    WHERE e.id = continuity_reports.episode_id
      AND (p.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE INDEX idx_continuity_reports_episode ON public.continuity_reports(episode_id);

-- Psychology reviews
CREATE TABLE IF NOT EXISTS public.psychology_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  agent_run_id UUID REFERENCES public.agent_runs(id),
  character_assessments JSONB NOT NULL DEFAULT '[]',
  verdict public.review_verdict NOT NULL DEFAULT 'pass',
  recommendations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.psychology_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own psychology reviews" ON public.psychology_reviews
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.episodes e
    JOIN public.seasons sn ON sn.id = e.season_id
    JOIN public.series s ON s.id = sn.series_id
    JOIN public.projects p ON p.id = s.project_id
    WHERE e.id = psychology_reviews.episode_id
      AND (p.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE INDEX idx_psychology_reviews_episode ON public.psychology_reviews(episode_id);

-- Legal/ethics reviews
CREATE TABLE IF NOT EXISTS public.legal_ethics_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  agent_run_id UUID REFERENCES public.agent_runs(id),
  flags JSONB NOT NULL DEFAULT '[]',
  verdict public.review_verdict NOT NULL DEFAULT 'pass',
  recommendations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_ethics_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own legal reviews" ON public.legal_ethics_reviews
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.episodes e
    JOIN public.seasons sn ON sn.id = e.season_id
    JOIN public.series s ON s.id = sn.series_id
    JOIN public.projects p ON p.id = s.project_id
    WHERE e.id = legal_ethics_reviews.episode_id
      AND (p.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE INDEX idx_legal_reviews_episode ON public.legal_ethics_reviews(episode_id);

-- Brand safety flags
CREATE TABLE IF NOT EXISTS public.brand_safety_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID REFERENCES public.episodes(id) ON DELETE CASCADE,
  shot_id UUID REFERENCES public.shots(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  description TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_safety_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view brand safety flags" ON public.brand_safety_flags
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage brand safety" ON public.brand_safety_flags
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_brand_safety_episode ON public.brand_safety_flags(episode_id);

CREATE TRIGGER update_brand_safety_updated_at
  BEFORE UPDATE ON public.brand_safety_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
