
-- 1. Fix provider_registry: restrict to authenticated
DROP POLICY IF EXISTS "Anyone can view provider_registry" ON public.provider_registry;
CREATE POLICY "Authenticated can view provider_registry"
  ON public.provider_registry FOR SELECT TO authenticated
  USING (true);

-- 2. Fix agent_outputs: also check episode-only runs
DROP POLICY IF EXISTS "Users can view own agent_outputs" ON public.agent_outputs;
CREATE POLICY "Users can view own agent_outputs"
  ON public.agent_outputs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agent_runs ar
      WHERE ar.id = agent_outputs.agent_run_id
      AND (
        (ar.series_id IS NOT NULL AND public.user_owns_series(ar.series_id))
        OR (ar.episode_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM episodes e
          JOIN seasons s ON s.id = e.season_id
          WHERE e.id = ar.episode_id AND public.user_owns_series(s.series_id)
        ))
        OR public.has_role(auth.uid(), 'admin')
      )
    )
  );

-- 3. Add DELETE policy on source_documents
CREATE POLICY "Users can delete own source_documents"
  ON public.source_documents FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid());

-- 4. Storage DELETE policies
CREATE POLICY "Users delete own face refs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'face-references' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own renders"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'renders' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own shot outputs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'shot-outputs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own source documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'source-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
