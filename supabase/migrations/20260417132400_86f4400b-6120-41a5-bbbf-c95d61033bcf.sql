
-- ═══════════════════════════════════════════════════════════
-- PHASE 1 : Architecture hardening (P0.1 → P0.5)
-- ═══════════════════════════════════════════════════════════

-- ── 1. Reaper audit table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reaper_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  agent_runs_reaped integer NOT NULL DEFAULT 0,
  workflow_runs_reaped integer NOT NULL DEFAULT 0,
  exports_reaped integer NOT NULL DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb,
  details jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.reaper_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view reaper runs"
  ON public.reaper_runs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_reaper_runs_started ON public.reaper_runs(started_at DESC);

-- ── 2. Budget enforcement infrastructure ──────────────────
-- Add enforcement_mode to project_budgets if missing
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='project_budgets')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='project_budgets' AND column_name='enforcement_mode'
     ) THEN
    ALTER TABLE public.project_budgets
      ADD COLUMN enforcement_mode text NOT NULL DEFAULT 'shadow'
      CHECK (enforcement_mode IN ('off', 'shadow', 'enforce'));
  END IF;
END $$;

-- Budget violation log (always written, even in shadow mode)
CREATE TABLE IF NOT EXISTS public.budget_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  agent_slug text,
  attempted_credits integer,
  current_spend integer,
  ceiling integer,
  enforcement_mode text NOT NULL,
  blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their budget violations"
  ON public.budget_violations FOR SELECT
  USING (project_id IS NULL OR public.user_owns_project(project_id) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_budget_violations_project ON public.budget_violations(project_id, created_at DESC);

-- ── 3. State transition invariants ────────────────────────
-- Forbidden transition rules, configurable
CREATE TABLE IF NOT EXISTS public.forbidden_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  to_state text NOT NULL,
  required_predecessor text,
  required_artifact text,
  enforcement_mode text NOT NULL DEFAULT 'enforce' CHECK (enforcement_mode IN ('off', 'shadow', 'enforce')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain, to_state)
);

ALTER TABLE public.forbidden_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read transition rules"
  ON public.forbidden_transitions FOR SELECT
  USING (true);

CREATE POLICY "Admins manage transition rules"
  ON public.forbidden_transitions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed initial invariants
INSERT INTO public.forbidden_transitions (domain, to_state, required_predecessor, required_artifact, description)
VALUES
  ('delivery_manifest', 'delivered', 'qc_passed', NULL, 'Cannot deliver without QC passing'),
  ('delivery_manifest', 'published', 'delivered', NULL, 'Cannot publish without delivery'),
  ('episode', 'delivered', 'finishing', NULL, 'Episode must complete finishing before delivery'),
  ('export_version', 'completed', NULL, 'output_url', 'Export cannot complete without output URL')
ON CONFLICT (domain, to_state) DO NOTHING;

-- Trigger function: enforce delivery_manifests transitions
CREATE OR REPLACE FUNCTION public.enforce_delivery_manifest_transitions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule record;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_rule FROM public.forbidden_transitions
  WHERE domain = 'delivery_manifest' AND to_state = NEW.status AND enforcement_mode != 'off';

  IF v_rule.id IS NOT NULL AND v_rule.required_predecessor IS NOT NULL THEN
    IF OLD.status != v_rule.required_predecessor THEN
      IF v_rule.enforcement_mode = 'enforce' THEN
        RAISE EXCEPTION 'Forbidden transition: delivery_manifest % → % (requires predecessor: %)',
          OLD.status, NEW.status, v_rule.required_predecessor;
      ELSE
        INSERT INTO public.diagnostic_events (project_id, severity, scope, event_type, title, detail, raw_data)
        SELECT p.id, 'warning', 'governance', 'forbidden_transition_shadow',
          'Transition normalement interdite (shadow mode)',
          format('delivery_manifest %s → %s sans predecessor %s', OLD.status, NEW.status, v_rule.required_predecessor),
          jsonb_build_object('manifest_id', NEW.id, 'rule_id', v_rule.id)
        FROM public.series s JOIN public.projects p ON p.id = s.project_id
        WHERE s.id = NEW.series_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_delivery_manifest_transitions ON public.delivery_manifests;
CREATE TRIGGER trg_enforce_delivery_manifest_transitions
  BEFORE UPDATE OF status ON public.delivery_manifests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_delivery_manifest_transitions();

-- Trigger function: enforce export_versions completion
CREATE OR REPLACE FUNCTION public.enforce_export_version_completion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (NEW.output_url IS NULL OR NEW.output_url = '') THEN
    RAISE EXCEPTION 'Forbidden: export_version cannot be completed without output_url';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_export_version_completion ON public.export_versions;
CREATE TRIGGER trg_enforce_export_version_completion
  BEFORE UPDATE OF status ON public.export_versions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_export_version_completion();

-- ── 4. Audit logs index for correlation ───────────────────
CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation
  ON public.audit_logs(correlation_id, created_at DESC)
  WHERE correlation_id IS NOT NULL;

-- ── 5. Architecture health snapshot view ──────────────────
CREATE OR REPLACE VIEW public.architecture_health_snapshot AS
SELECT
  -- Jobs zombies
  (SELECT count(*) FROM public.agent_runs
    WHERE status IN ('running','queued') AND started_at < now() - interval '15 minutes') AS agent_runs_stuck,
  (SELECT count(*) FROM public.workflow_runs
    WHERE status = 'running' AND created_at < now() - interval '2 hours') AS workflow_runs_stuck,
  (SELECT count(*) FROM public.export_versions
    WHERE status = 'pending' AND created_at < now() - interval '1 hour') AS exports_stuck,
  -- Documents
  (SELECT count(*) FROM public.source_documents) AS docs_total,
  (SELECT count(*) FROM public.source_documents
    WHERE parser_version IS NULL OR parser_version = 'legacy') AS docs_legacy,
  (SELECT count(*) FROM public.source_documents WHERE status = 'parsing_failed') AS docs_failed,
  -- Budget
  (SELECT count(*) FROM public.budget_violations
    WHERE created_at > now() - interval '7 days') AS budget_violations_7d,
  (SELECT count(*) FROM public.budget_violations
    WHERE blocked = true AND created_at > now() - interval '7 days') AS budget_blocks_7d,
  -- Governance
  (SELECT count(*) FROM public.governance_violations
    WHERE created_at > now() - interval '7 days') AS governance_violations_7d,
  (SELECT count(*) FROM public.incidents
    WHERE created_at > now() - interval '7 days') AS incidents_7d,
  (SELECT count(*) FROM public.diagnostic_events
    WHERE severity IN ('error','critical') AND created_at > now() - interval '7 days') AS errors_7d,
  -- Latency
  (SELECT round(avg(latency_ms)::numeric, 0) FROM public.agent_runs
    WHERE created_at > now() - interval '24 hours' AND status = 'completed') AS avg_agent_latency_ms_24h,
  -- Reaper
  (SELECT max(started_at) FROM public.reaper_runs) AS last_reaper_run,
  (SELECT coalesce(sum(agent_runs_reaped + workflow_runs_reaped + exports_reaped), 0)
    FROM public.reaper_runs WHERE started_at > now() - interval '7 days') AS jobs_reaped_7d,
  now() AS snapshot_at;

GRANT SELECT ON public.architecture_health_snapshot TO authenticated;
