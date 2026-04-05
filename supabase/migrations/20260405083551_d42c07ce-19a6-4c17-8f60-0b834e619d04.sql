
DROP VIEW IF EXISTS public.webhook_endpoints_safe;
CREATE VIEW public.webhook_endpoints_safe
  WITH (security_invoker = true)
  AS SELECT id, user_id, url,
    CASE WHEN secret IS NOT NULL THEN '***' || RIGHT(secret, 8) ELSE NULL END AS secret_masked,
    events, active, created_at, updated_at
  FROM public.webhook_endpoints;
