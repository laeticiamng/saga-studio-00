-- Migration 1B: Series hierarchy tables (series, seasons, episodes, scenes, scripts)

-- SERIES: top-level container, references projects table for ownership
CREATE TABLE IF NOT EXISTS public.series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  logline TEXT,
  genre TEXT,
  target_audience TEXT,
  tone TEXT,
  total_seasons INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own series" ON public.series
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = series.project_id
      AND (projects.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "Users can insert own series" ON public.series
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = series.project_id AND projects.user_id = auth.uid()::text
  ));

CREATE POLICY "Users can update own series" ON public.series
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = series.project_id
      AND (projects.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "Users can delete own series" ON public.series
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = series.project_id
      AND (projects.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE TRIGGER update_series_updated_at
  BEFORE UPDATE ON public.series
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SEASONS
CREATE TABLE IF NOT EXISTS public.seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  title TEXT,
  synopsis TEXT,
  arc_summary TEXT,
  episode_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (series_id, number)
);

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own seasons" ON public.seasons
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.series s
    JOIN public.projects p ON p.id = s.project_id
    WHERE s.id = seasons.series_id
      AND (p.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "Users can manage own seasons" ON public.seasons
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.series s
    JOIN public.projects p ON p.id = s.project_id
    WHERE s.id = seasons.series_id AND p.user_id = auth.uid()::text
  ));

CREATE INDEX idx_seasons_series_id ON public.seasons(series_id);

CREATE TRIGGER update_seasons_updated_at
  BEFORE UPDATE ON public.seasons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- EPISODES
CREATE TABLE IF NOT EXISTS public.episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  number INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT 'Sans titre',
  synopsis TEXT,
  status public.episode_status NOT NULL DEFAULT 'draft',
  duration_target_sec INTEGER DEFAULT 300,
  previously_on TEXT,
  next_episode_hook TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season_id, number)
);

ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own episodes" ON public.episodes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.seasons sn
    JOIN public.series s ON s.id = sn.series_id
    JOIN public.projects p ON p.id = s.project_id
    WHERE sn.id = episodes.season_id
      AND (p.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "Users can manage own episodes" ON public.episodes
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.seasons sn
    JOIN public.series s ON s.id = sn.series_id
    JOIN public.projects p ON p.id = s.project_id
    WHERE sn.id = episodes.season_id AND p.user_id = auth.uid()::text
  ));

CREATE INDEX idx_episodes_season_id ON public.episodes(season_id);
CREATE INDEX idx_episodes_project_id ON public.episodes(project_id);

CREATE TRIGGER update_episodes_updated_at
  BEFORE UPDATE ON public.episodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SCENES (breakdown within an episode)
CREATE TABLE IF NOT EXISTS public.scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  title TEXT,
  description TEXT,
  location TEXT,
  time_of_day TEXT,
  mood TEXT,
  duration_target_sec INTEGER,
  characters JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scenes" ON public.scenes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.episodes e
    JOIN public.seasons sn ON sn.id = e.season_id
    JOIN public.series s ON s.id = sn.series_id
    JOIN public.projects p ON p.id = s.project_id
    WHERE e.id = scenes.episode_id
      AND (p.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "Users can manage own scenes" ON public.scenes
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.episodes e
    JOIN public.seasons sn ON sn.id = e.season_id
    JOIN public.series s ON s.id = sn.series_id
    JOIN public.projects p ON p.id = s.project_id
    WHERE e.id = scenes.episode_id AND p.user_id = auth.uid()::text
  ));

CREATE INDEX idx_scenes_episode_id ON public.scenes(episode_id);

CREATE TRIGGER update_scenes_updated_at
  BEFORE UPDATE ON public.scenes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link shots to scenes (optional FK, existing shots remain project_id only)
ALTER TABLE public.shots ADD COLUMN IF NOT EXISTS scene_id UUID REFERENCES public.scenes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_shots_scene_id ON public.shots(scene_id);

-- SCRIPTS (1:1 with episodes)
CREATE TABLE IF NOT EXISTS public.scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE UNIQUE,
  current_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scripts" ON public.scripts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.episodes e
    JOIN public.seasons sn ON sn.id = e.season_id
    JOIN public.series s ON s.id = sn.series_id
    JOIN public.projects p ON p.id = s.project_id
    WHERE e.id = scripts.episode_id
      AND (p.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "Users can manage own scripts" ON public.scripts
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.episodes e
    JOIN public.seasons sn ON sn.id = e.season_id
    JOIN public.series s ON s.id = sn.series_id
    JOIN public.projects p ON p.id = s.project_id
    WHERE e.id = scripts.episode_id AND p.user_id = auth.uid()::text
  ));

CREATE TRIGGER update_scripts_updated_at
  BEFORE UPDATE ON public.scripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SCRIPT VERSIONS
CREATE TABLE IF NOT EXISTS public.script_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  change_summary TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (script_id, version)
);

ALTER TABLE public.script_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own script versions" ON public.script_versions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.scripts sc
    JOIN public.episodes e ON e.id = sc.episode_id
    JOIN public.seasons sn ON sn.id = e.season_id
    JOIN public.series s ON s.id = sn.series_id
    JOIN public.projects p ON p.id = s.project_id
    WHERE sc.id = script_versions.script_id
      AND (p.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "Users can manage own script versions" ON public.script_versions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.scripts sc
    JOIN public.episodes e ON e.id = sc.episode_id
    JOIN public.seasons sn ON sn.id = e.season_id
    JOIN public.series s ON s.id = sn.series_id
    JOIN public.projects p ON p.id = s.project_id
    WHERE sc.id = script_versions.script_id AND p.user_id = auth.uid()::text
  ));
