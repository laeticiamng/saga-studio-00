-- ─── LOT A : correlation_id propagation ──────────────────────────────────
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS correlation_id uuid;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS correlation_id uuid;
ALTER TABLE public.diagnostic_events ADD COLUMN IF NOT EXISTS correlation_id uuid;

-- incidents & workflow_steps : add only if tables exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='incidents') THEN
    EXECUTE 'ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS correlation_id uuid';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_incidents_correlation ON public.incidents(correlation_id) WHERE correlation_id IS NOT NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='workflow_steps') THEN
    EXECUTE 'ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS correlation_id uuid';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_workflow_steps_correlation ON public.workflow_steps(correlation_id) WHERE correlation_id IS NOT NULL';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_runs_correlation ON public.agent_runs(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation ON public.audit_logs(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_diagnostic_events_correlation ON public.diagnostic_events(correlation_id) WHERE correlation_id IS NOT NULL;

-- ─── LOT C : conflict resolution rules ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conflict_resolution_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  field_key text NOT NULL,
  strategy text NOT NULL CHECK (strategy IN ('most_recent', 'highest_confidence', 'source_priority', 'manual')),
  source_priority jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_type, field_key)
);

ALTER TABLE public.conflict_resolution_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view conflict rules" ON public.conflict_resolution_rules
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert conflict rules" ON public.conflict_resolution_rules
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update conflict rules" ON public.conflict_resolution_rules
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete conflict rules" ON public.conflict_resolution_rules
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_conflict_rules_updated
  BEFORE UPDATE ON public.conflict_resolution_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.conflict_resolution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conflict_id uuid,
  project_id uuid,
  rule_id uuid REFERENCES public.conflict_resolution_rules(id) ON DELETE SET NULL,
  strategy_used text NOT NULL,
  resolved_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conflict_resolution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view conflict log" ON public.conflict_resolution_log
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_conflict_log_project ON public.conflict_resolution_log(project_id);

-- Seed default rules
INSERT INTO public.conflict_resolution_rules (entity_type, field_key, strategy)
VALUES
  ('project', 'title', 'highest_confidence'),
  ('project', 'synopsis', 'most_recent'),
  ('project', 'genre', 'highest_confidence'),
  ('character', 'name', 'highest_confidence'),
  ('character', 'description', 'most_recent')
ON CONFLICT (entity_type, field_key) DO NOTHING;

-- ─── LOT F : QC summary denormalization ──────────────────────────────────
ALTER TABLE public.delivery_manifests ADD COLUMN IF NOT EXISTS qc_summary jsonb;

CREATE OR REPLACE FUNCTION public.denormalize_qc_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_summary jsonb;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT jsonb_build_object(
      'total_validations', COUNT(*),
      'passed', COUNT(*) FILTER (WHERE validation_status = 'passed'),
      'failed', COUNT(*) FILTER (WHERE validation_status = 'failed'),
      'blocking', COUNT(*) FILTER (WHERE blocking = true),
      'pass_rate', CASE WHEN COUNT(*) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE validation_status = 'passed')::numeric / COUNT(*)::numeric) * 100, 2)
        ELSE NULL END,
      'snapshot_at', now()
    ) INTO v_summary
    FROM public.asset_validations av
    WHERE av.episode_shot_id IN (
      SELECT id FROM public.episode_shots WHERE episode_id = NEW.episode_id
    );
    NEW.qc_summary := COALESCE(v_summary, jsonb_build_object('total_validations', 0, 'snapshot_at', now()));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_denormalize_qc ON public.delivery_manifests;
CREATE TRIGGER trg_denormalize_qc
  BEFORE UPDATE ON public.delivery_manifests
  FOR EACH ROW EXECUTE FUNCTION public.denormalize_qc_on_completion();

-- Reporting view (admin-only via RLS on underlying tables; but views need explicit restriction)
CREATE OR REPLACE VIEW public.qc_pass_rate_by_week
WITH (security_invoker = on) AS
SELECT
  date_trunc('week', updated_at) AS week,
  COUNT(*) AS total_completed,
  AVG((qc_summary->>'pass_rate')::numeric) AS avg_pass_rate,
  SUM((qc_summary->>'failed')::int) AS total_failed,
  SUM((qc_summary->>'blocking')::int) AS total_blocking
FROM public.delivery_manifests
WHERE status = 'completed' AND qc_summary IS NOT NULL
GROUP BY date_trunc('week', updated_at)
ORDER BY week DESC;

COMMENT ON VIEW public.qc_pass_rate_by_week IS 'Hebdomadaire: taux de réussite QC sur les manifests livrés';
