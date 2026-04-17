
ALTER FUNCTION public.compute_audit_hash(uuid, text, uuid, text, uuid, jsonb, uuid, timestamptz, text)
  SET search_path = public, extensions;
ALTER FUNCTION public.prevent_audit_log_mutation() SET search_path = public;
ALTER FUNCTION public.seal_audit_log() SET search_path = public;
ALTER FUNCTION public.verify_audit_chain(integer) SET search_path = public;
ALTER FUNCTION public.check_project_budget(uuid, integer) SET search_path = public;
ALTER FUNCTION public.track_project_credit_spend() SET search_path = public;
