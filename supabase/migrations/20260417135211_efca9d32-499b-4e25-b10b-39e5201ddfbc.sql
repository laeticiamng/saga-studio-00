
-- Phase 4 — audit log immutability + cost guardrails per project + renderer fallback flag

-- 1. AUDIT LOG IMMUTABILITY (hash chain + WORM enforcement)
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS prev_hash text,
  ADD COLUMN IF NOT EXISTS row_hash text;

CREATE OR REPLACE FUNCTION public.compute_audit_hash(
  _id uuid, _entity_type text, _entity_id uuid, _action text,
  _user_id uuid, _details jsonb, _correlation_id uuid, _created_at timestamptz, _prev_hash text
) RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT encode(
    digest(
      coalesce(_id::text,'') || '|' ||
      coalesce(_entity_type,'') || '|' ||
      coalesce(_entity_id::text,'') || '|' ||
      coalesce(_action,'') || '|' ||
      coalesce(_user_id::text,'') || '|' ||
      coalesce(_details::text,'') || '|' ||
      coalesce(_correlation_id::text,'') || '|' ||
      coalesce(_created_at::text,'') || '|' ||
      coalesce(_prev_hash,''),
      'sha256'
    ), 'hex'
  );
$$;

CREATE OR REPLACE FUNCTION public.seal_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_prev text;
BEGIN
  SELECT row_hash INTO v_prev FROM public.audit_logs
  ORDER BY created_at DESC, id DESC LIMIT 1;
  NEW.prev_hash := v_prev;
  NEW.row_hash := public.compute_audit_hash(
    NEW.id, NEW.entity_type, NEW.entity_id, NEW.action,
    NEW.user_id, NEW.details, NEW.correlation_id, NEW.created_at, v_prev
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_seal_audit_log ON public.audit_logs;
CREATE TRIGGER trg_seal_audit_log
BEFORE INSERT ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.seal_audit_log();

CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (WORM): % forbidden', TG_OP;
END; $$;

DROP TRIGGER IF EXISTS trg_audit_log_no_update ON public.audit_logs;
CREATE TRIGGER trg_audit_log_no_update
BEFORE UPDATE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_audit_log_no_delete ON public.audit_logs;
CREATE TRIGGER trg_audit_log_no_delete
BEFORE DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

CREATE OR REPLACE FUNCTION public.verify_audit_chain(p_limit integer DEFAULT 10000)
RETURNS TABLE(broken_id uuid, expected_hash text, actual_hash text, chain_position bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_prev text := NULL;
  v_expected text;
  v_pos bigint := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  FOR r IN
    SELECT id, entity_type, entity_id, action, user_id, details, correlation_id, created_at, prev_hash, row_hash
    FROM public.audit_logs ORDER BY created_at ASC, id ASC LIMIT p_limit
  LOOP
    v_pos := v_pos + 1;
    v_expected := public.compute_audit_hash(
      r.id, r.entity_type, r.entity_id, r.action,
      r.user_id, r.details, r.correlation_id, r.created_at, v_prev
    );
    IF r.row_hash IS DISTINCT FROM v_expected OR r.prev_hash IS DISTINCT FROM v_prev THEN
      broken_id := r.id; expected_hash := v_expected; actual_hash := r.row_hash; chain_position := v_pos;
      RETURN NEXT;
    END IF;
    v_prev := r.row_hash;
  END LOOP;
END; $$;

-- 2. COST GUARDRAILS PER PROJECT
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS credit_ceiling integer,
  ADD COLUMN IF NOT EXISTS credit_spent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS guardrail_mode text NOT NULL DEFAULT 'shadow'
    CHECK (guardrail_mode IN ('off','shadow','enforce'));

CREATE INDEX IF NOT EXISTS idx_projects_guardrail ON public.projects(guardrail_mode)
  WHERE guardrail_mode <> 'off';

CREATE OR REPLACE FUNCTION public.check_project_budget(
  p_project_id uuid, p_amount integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proj record;
  v_new_total integer;
BEGIN
  SELECT id, user_id, credit_ceiling, credit_spent, guardrail_mode
    INTO v_proj FROM public.projects WHERE id = p_project_id;
  IF v_proj.id IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'project_not_found');
  END IF;
  IF v_proj.guardrail_mode = 'off' OR v_proj.credit_ceiling IS NULL THEN
    RETURN jsonb_build_object('allowed', true);
  END IF;
  v_new_total := COALESCE(v_proj.credit_spent, 0) + GREATEST(0, p_amount);
  IF v_new_total <= v_proj.credit_ceiling THEN
    RETURN jsonb_build_object('allowed', true, 'spent', v_new_total, 'ceiling', v_proj.credit_ceiling);
  END IF;
  INSERT INTO public.budget_violations (project_id, attempted_credits, ceiling, current_spend, enforcement_mode, blocked)
  VALUES (p_project_id, p_amount, v_proj.credit_ceiling, COALESCE(v_proj.credit_spent,0), v_proj.guardrail_mode,
          v_proj.guardrail_mode = 'enforce');
  RETURN jsonb_build_object(
    'allowed', v_proj.guardrail_mode <> 'enforce',
    'reason', 'project_ceiling_exceeded',
    'spent', COALESCE(v_proj.credit_spent,0),
    'ceiling', v_proj.credit_ceiling,
    'attempted', p_amount,
    'mode', v_proj.guardrail_mode
  );
END; $$;

CREATE OR REPLACE FUNCTION public.track_project_credit_spend()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_project_id uuid;
BEGIN
  IF NEW.delta >= 0 THEN RETURN NEW; END IF;
  IF NEW.ref_id IS NOT NULL THEN
    BEGIN
      v_project_id := split_part(NEW.ref_id, '_', 1)::uuid;
    EXCEPTION WHEN others THEN v_project_id := NULL;
    END;
  END IF;
  IF v_project_id IS NULL THEN RETURN NEW; END IF;
  UPDATE public.projects
    SET credit_spent = COALESCE(credit_spent, 0) + ABS(NEW.delta), updated_at = now()
    WHERE id = v_project_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_track_project_credit_spend ON public.credit_ledger;
CREATE TRIGGER trg_track_project_credit_spend
AFTER INSERT ON public.credit_ledger
FOR EACH ROW EXECUTE FUNCTION public.track_project_credit_spend();

-- 3. RENDERER FALLBACK STATE
CREATE TABLE IF NOT EXISTS public.renderer_fallback_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  external_healthy boolean NOT NULL DEFAULT true,
  consecutive_failures integer NOT NULL DEFAULT 0,
  last_check_at timestamptz NOT NULL DEFAULT now(),
  last_failure_at timestamptz,
  fallback_active boolean NOT NULL DEFAULT false,
  notes text
);

INSERT INTO public.renderer_fallback_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.renderer_fallback_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "renderer_fallback_state_read_admin" ON public.renderer_fallback_state;
CREATE POLICY "renderer_fallback_state_read_admin"
ON public.renderer_fallback_state FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
