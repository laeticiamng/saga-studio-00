
-- Scenes DELETE (use DO block for idempotency)
DO $$ BEGIN
  CREATE POLICY "Users can delete own scenes" ON public.scenes
    FOR DELETE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.episodes e
        JOIN public.seasons s ON s.id = e.season_id
        WHERE e.id = scenes.episode_id AND user_owns_series(s.series_id)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enable Realtime for key pipeline tables
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.workflow_runs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_runs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.episode_shots;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
