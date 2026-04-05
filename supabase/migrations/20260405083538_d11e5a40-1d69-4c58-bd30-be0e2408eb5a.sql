
-- 1. Fix feature_flags: restrict to authenticated only
DROP POLICY IF EXISTS "Anyone can view feature_flags" ON public.feature_flags;
CREATE POLICY "Authenticated can view feature_flags"
  ON public.feature_flags FOR SELECT TO authenticated USING (true);

-- 2. Fix webhook_endpoints: mask secret via a secure view
DROP POLICY IF EXISTS "Users can manage own webhooks" ON public.webhook_endpoints;

CREATE OR REPLACE VIEW public.webhook_endpoints_safe AS
  SELECT id, user_id, url,
    CASE WHEN secret IS NOT NULL THEN '***' || RIGHT(secret, 8) ELSE NULL END AS secret_masked,
    events, active, created_at, updated_at
  FROM public.webhook_endpoints;

-- 3. Storage UPDATE policies for all buckets
CREATE POLICY "Users update own audio"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'audio-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own face refs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'face-references' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own renders"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'renders' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own shot outputs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'shot-outputs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own source documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'source-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 4. Fix agent_runs SELECT policy
DROP POLICY IF EXISTS "Users can view own agent_runs" ON public.agent_runs;
DROP POLICY IF EXISTS "agent_runs_select" ON public.agent_runs;

CREATE POLICY "Users can view own agent_runs"
  ON public.agent_runs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (episode_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.episodes e
      JOIN public.seasons s ON s.id = e.season_id
      WHERE e.id = agent_runs.episode_id AND public.user_owns_series(s.series_id)
    ))
    OR (series_id IS NOT NULL AND public.user_owns_series(series_id))
    OR (episode_id IS NULL AND series_id IS NULL AND correlation_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.series sr ON sr.project_id = p.id
      JOIN public.agent_runs ar2 ON ar2.series_id = sr.id AND ar2.correlation_id = agent_runs.correlation_id
      WHERE p.user_id = auth.uid()
    ))
  );
