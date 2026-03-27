
-- Add duration_target_min to episodes (default 50 for series episodes)
ALTER TABLE public.episodes ADD COLUMN IF NOT EXISTS duration_target_min integer DEFAULT 50;

-- Add episode_duration_min to series config
ALTER TABLE public.series ADD COLUMN IF NOT EXISTS episode_duration_min integer DEFAULT 50;

-- Add episodes_per_season to series
ALTER TABLE public.series ADD COLUMN IF NOT EXISTS episodes_per_season integer DEFAULT 10;

-- Add shot_count to scenes for tracking
ALTER TABLE public.scenes ADD COLUMN IF NOT EXISTS shot_count integer DEFAULT 0;

-- Add scene_id to a new episode_shots table for scene-level shot tracking
CREATE TABLE IF NOT EXISTS public.episode_shots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  scene_id uuid REFERENCES public.scenes(id) ON DELETE SET NULL,
  idx integer NOT NULL DEFAULT 0,
  prompt text,
  negative_prompt text,
  duration_sec numeric DEFAULT 5,
  provider text,
  status text DEFAULT 'pending',
  output_url text,
  error_message text,
  seed integer,
  cost_credits integer DEFAULT 0,
  batch_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.episode_shots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their episode shots" ON public.episode_shots
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.episodes e
      JOIN public.seasons s ON s.id = e.season_id
      JOIN public.series sr ON sr.id = s.series_id
      JOIN public.projects p ON p.id = sr.project_id
      WHERE e.id = episode_shots.episode_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their episode shots" ON public.episode_shots
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.episodes e
      JOIN public.seasons s ON s.id = e.season_id
      JOIN public.series sr ON sr.id = s.series_id
      JOIN public.projects p ON p.id = sr.project_id
      WHERE e.id = episode_shots.episode_id AND p.user_id = auth.uid()
    )
  );

-- Service role can manage all
CREATE POLICY "Service can manage episode shots" ON public.episode_shots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_episode_shots_episode ON public.episode_shots(episode_id);
CREATE INDEX IF NOT EXISTS idx_episode_shots_scene ON public.episode_shots(scene_id);
CREATE INDEX IF NOT EXISTS idx_episode_shots_batch ON public.episode_shots(episode_id, batch_index);

-- Add render_batches table if not exists (for long-form batch rendering)
CREATE TABLE IF NOT EXISTS public.render_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  season_id uuid REFERENCES public.seasons(id) ON DELETE SET NULL,
  episode_ids jsonb DEFAULT '[]',
  status text DEFAULT 'pending',
  progress jsonb DEFAULT '{}',
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.render_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their render batches" ON public.render_batches
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.series sr
      JOIN public.projects p ON p.id = sr.project_id
      WHERE sr.id = render_batches.series_id AND p.user_id = auth.uid()
    )
  );
