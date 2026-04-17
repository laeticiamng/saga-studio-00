
-- RPC: report renderer health & auto-toggle fallback
CREATE OR REPLACE FUNCTION public.report_renderer_health(
  p_success boolean,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state public.renderer_fallback_state%ROWTYPE;
  v_threshold int := 3;
BEGIN
  INSERT INTO public.renderer_fallback_state (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

  SELECT * INTO v_state FROM public.renderer_fallback_state WHERE id = 1 FOR UPDATE;

  IF p_success THEN
    UPDATE public.renderer_fallback_state
      SET external_healthy = true,
          consecutive_failures = 0,
          last_check_at = now(),
          fallback_active = false,
          notes = NULL
      WHERE id = 1;
  ELSE
    UPDATE public.renderer_fallback_state
      SET consecutive_failures = consecutive_failures + 1,
          last_check_at = now(),
          last_failure_at = now(),
          external_healthy = (consecutive_failures + 1 < v_threshold),
          fallback_active = (consecutive_failures + 1 >= v_threshold),
          notes = COALESCE(p_notes, notes)
      WHERE id = 1;
  END IF;

  SELECT * INTO v_state FROM public.renderer_fallback_state WHERE id = 1;
  RETURN jsonb_build_object(
    'external_healthy', v_state.external_healthy,
    'fallback_active', v_state.fallback_active,
    'consecutive_failures', v_state.consecutive_failures
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_renderer_health(boolean, text) TO service_role, authenticated;

-- Read helper for edge functions to check current state
CREATE OR REPLACE FUNCTION public.get_renderer_fallback_state()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'external_healthy', external_healthy,
    'fallback_active', fallback_active,
    'consecutive_failures', consecutive_failures,
    'last_check_at', last_check_at
  ) FROM public.renderer_fallback_state WHERE id = 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_renderer_fallback_state() TO service_role, authenticated;
