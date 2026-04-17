-- Re-create the function with explicit search_path (already set, but linter sometimes flags re-check)
CREATE OR REPLACE FUNCTION public.denormalize_qc_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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