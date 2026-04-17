-- PHASE 2 v3 — types alignés sur UNION

-- P2.1 stale gate function
CREATE OR REPLACE FUNCTION public.mark_downstream_gates_stale()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_project_id uuid; v_episode_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'scripts' THEN v_episode_id := NEW.episode_id;
  ELSIF TG_TABLE_NAME = 'scenes' THEN v_episode_id := NEW.episode_id;
  ELSIF TG_TABLE_NAME = 'timelines' THEN v_project_id := NEW.project_id; v_episode_id := NEW.episode_id;
  END IF;
  UPDATE public.review_gates SET stale = true, updated_at = now()
  WHERE status IN ('pending', 'approved') AND COALESCE(stale, false) = false
    AND ((v_episode_id IS NOT NULL AND episode_id = v_episode_id)
      OR (v_project_id IS NOT NULL AND project_id = v_project_id AND episode_id IS NULL));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_scripts_stale_gates ON public.scripts;
CREATE TRIGGER trg_scripts_stale_gates AFTER UPDATE ON public.scripts
  FOR EACH ROW WHEN (OLD.current_version IS DISTINCT FROM NEW.current_version)
  EXECUTE FUNCTION public.mark_downstream_gates_stale();

DROP TRIGGER IF EXISTS trg_scenes_stale_gates ON public.scenes;
CREATE TRIGGER trg_scenes_stale_gates AFTER UPDATE ON public.scenes
  FOR EACH ROW EXECUTE FUNCTION public.mark_downstream_gates_stale();

DROP TRIGGER IF EXISTS trg_timelines_stale_gates ON public.timelines;
CREATE TRIGGER trg_timelines_stale_gates AFTER UPDATE ON public.timelines
  FOR EACH ROW WHEN (OLD.version IS DISTINCT FROM NEW.version)
  EXECUTE FUNCTION public.mark_downstream_gates_stale();

-- P2.2 active gates view
CREATE OR REPLACE VIEW public.active_review_gates WITH (security_invoker = true) AS
SELECT * FROM public.review_gates WHERE COALESCE(stale, false) = false;

-- P2.3 idempotence credits
CREATE UNIQUE INDEX IF NOT EXISTS uniq_credit_ledger_idem
  ON public.credit_ledger (ref_id, ref_type)
  WHERE ref_id IS NOT NULL AND ref_type IS NOT NULL AND delta < 0;

-- P2.4 DLQ view (all columns explicitly cast for UNION safety)
CREATE OR REPLACE VIEW public.dead_letter_jobs WITH (security_invoker = true) AS
SELECT
  ar.id::uuid AS id,
  'agent_run'::text AS job_type,
  ar.agent_slug::text AS slug,
  ar.episode_id::uuid AS episode_id,
  ar.error_message::text AS error_message,
  COALESCE(ar.retry_count, 0)::int AS retry_count,
  COALESCE(ar.max_retries, 3)::int AS max_retries,
  ar.created_at::timestamptz AS created_at,
  ar.completed_at::timestamptz AS completed_at,
  ar.correlation_id::uuid AS correlation_id
FROM public.agent_runs ar
WHERE ar.status = 'failed'
  AND COALESCE(ar.retry_count, 0) >= COALESCE(ar.max_retries, 3)
  AND ar.completed_at < (now() - interval '24 hours')
UNION ALL
SELECT
  ev.id::uuid AS id,
  'export_version'::text AS job_type,
  COALESCE(ev.preset_name, ev.format)::text AS slug,
  ev.episode_id::uuid AS episode_id,
  ev.failure_stage::text AS error_message,
  COALESCE(ev.retry_count, 0)::int AS retry_count,
  3::int AS max_retries,
  ev.created_at::timestamptz AS created_at,
  ev.updated_at::timestamptz AS completed_at,
  NULL::uuid AS correlation_id
FROM public.export_versions ev
WHERE ev.status = 'failed'
  AND COALESCE(ev.retry_count, 0) >= 3
  AND ev.updated_at < (now() - interval '24 hours');

-- P2.5 rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  tokens integer NOT NULL DEFAULT 0,
  capacity integer NOT NULL DEFAULT 60,
  refill_per_minute integer NOT NULL DEFAULT 30,
  last_refill_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rate_limit_buckets_admin_select" ON public.rate_limit_buckets;
CREATE POLICY "rate_limit_buckets_admin_select" ON public.rate_limit_buckets
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_user_id uuid, p_endpoint text, p_cost integer DEFAULT 1,
  p_capacity integer DEFAULT 60, p_refill_per_minute integer DEFAULT 30
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.rate_limit_buckets%ROWTYPE;
  v_now timestamptz := now();
  v_elapsed_min numeric; v_refill numeric; v_new_tokens integer;
BEGIN
  INSERT INTO public.rate_limit_buckets (user_id, endpoint, tokens, capacity, refill_per_minute, last_refill_at)
  VALUES (p_user_id, p_endpoint, p_capacity, p_capacity, p_refill_per_minute, v_now)
  ON CONFLICT (user_id, endpoint) DO NOTHING;
  SELECT * INTO v_row FROM public.rate_limit_buckets
  WHERE user_id = p_user_id AND endpoint = p_endpoint FOR UPDATE;
  v_elapsed_min := EXTRACT(EPOCH FROM (v_now - v_row.last_refill_at)) / 60.0;
  v_refill := v_elapsed_min * v_row.refill_per_minute;
  v_new_tokens := LEAST(v_row.capacity, v_row.tokens + FLOOR(v_refill)::int);
  IF v_new_tokens < p_cost THEN
    UPDATE public.rate_limit_buckets SET tokens = v_new_tokens, last_refill_at = v_now, updated_at = v_now WHERE id = v_row.id;
    RETURN jsonb_build_object('allowed', false, 'remaining', v_new_tokens, 'capacity', v_row.capacity);
  END IF;
  UPDATE public.rate_limit_buckets SET tokens = v_new_tokens - p_cost, last_refill_at = v_now, updated_at = v_now WHERE id = v_row.id;
  RETURN jsonb_build_object('allowed', true, 'remaining', v_new_tokens - p_cost, 'capacity', v_row.capacity);
END; $$;

-- P2.6 canonical field schemas
CREATE TABLE IF NOT EXISTS public.canonical_field_schemas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key text NOT NULL,
  entity_type text NOT NULL DEFAULT 'project',
  json_schema jsonb NOT NULL,
  description text,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (field_key, entity_type, version)
);
ALTER TABLE public.canonical_field_schemas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "canonical_field_schemas_read" ON public.canonical_field_schemas;
CREATE POLICY "canonical_field_schemas_read" ON public.canonical_field_schemas
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "canonical_field_schemas_admin_write" ON public.canonical_field_schemas;
CREATE POLICY "canonical_field_schemas_admin_write" ON public.canonical_field_schemas
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.canonical_field_schemas (field_key, entity_type, json_schema, description, version) VALUES
  ('title', 'project', '{"type":"string","minLength":1,"maxLength":255}'::jsonb, 'Titre canonique du projet', 1),
  ('synopsis', 'project', '{"type":"string","minLength":10}'::jsonb, 'Synopsis canonique', 1),
  ('genre', 'project', '{"type":"string","enum":["drama","comedy","thriller","horror","sci-fi","romance","documentary","music_video","other"]}'::jsonb, 'Genre canonique', 1),
  ('tone', 'project', '{"type":"string","maxLength":100}'::jsonb, 'Ton du projet', 1),
  ('protagonist', 'character', '{"type":"object","required":["name"],"properties":{"name":{"type":"string"},"role":{"type":"string"}}}'::jsonb, 'Personnage principal canonique', 1)
ON CONFLICT (field_key, entity_type, version) DO NOTHING;

-- P2.7 chain depth
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS chain_depth integer DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_agent_runs_chain_depth ON public.agent_runs (chain_depth) WHERE chain_depth > 5;
CREATE INDEX IF NOT EXISTS idx_agent_runs_failed_dlq ON public.agent_runs (status, completed_at) WHERE status = 'failed';

-- P2.9 policy enforcement helper
CREATE OR REPLACE FUNCTION public.set_policy_enforcement(p_policy_key text, p_mode text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden: admin only'; END IF;
  IF p_mode NOT IN ('off', 'shadow', 'enforce') THEN RAISE EXCEPTION 'Invalid mode: %', p_mode; END IF;
  UPDATE public.governance_policies SET enforcement_mode = p_mode WHERE policy_key = p_policy_key;
  INSERT INTO public.audit_logs (entity_type, entity_id, action, user_id, details)
  SELECT 'governance_policy', id, 'enforcement_mode_changed', auth.uid(),
    jsonb_build_object('policy_key', p_policy_key, 'new_mode', p_mode)
  FROM public.governance_policies WHERE policy_key = p_policy_key;
END; $$;