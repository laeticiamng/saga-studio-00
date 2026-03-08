
CREATE VIEW public.projects_public
WITH (security_invoker = on) AS
  SELECT id, title, type, style_preset, status
  FROM public.projects
  WHERE status = 'completed'::project_status;
