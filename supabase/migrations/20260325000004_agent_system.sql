-- Migration 2A: Agent system tables

-- Agent registry
CREATE TABLE IF NOT EXISTS public.agent_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  role TEXT NOT NULL,
  category TEXT NOT NULL,
  status public.agent_status NOT NULL DEFAULT 'active',
  config JSONB DEFAULT '{}',
  dependencies TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read agents" ON public.agent_registry
  FOR SELECT USING (true);

CREATE POLICY "Admins manage agents" ON public.agent_registry
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_agent_registry_updated_at
  BEFORE UPDATE ON public.agent_registry
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the 16 agents
INSERT INTO public.agent_registry (slug, name, description, role, category, dependencies) VALUES
  ('showrunner',           'Showrunner',              'Orchestre la production globale de la série',         'orchestrator', 'production', '{}'),
  ('story_architect',      'Architecte narratif',     'Conçoit les arcs narratifs et la structure',          'creator',      'writing',    '{}'),
  ('scriptwriter',         'Scénariste',              'Rédige les scripts détaillés par épisode',            'creator',      'writing',    '{story_architect}'),
  ('dialogue_coach',       'Coach dialogues',         'Affine les dialogues et la voix des personnages',     'refiner',      'writing',    '{scriptwriter}'),
  ('psychology_reviewer',  'Psychologue narratif',    'Valide la cohérence psychologique des personnages',   'reviewer',     'validation', '{scriptwriter}'),
  ('legal_ethics_reviewer','Conseiller juridique',    'Vérifie la conformité légale et éthique',             'reviewer',     'validation', '{scriptwriter}'),
  ('continuity_checker',   'Vérificateur continuité', 'Garantit la cohérence inter-épisodes',                'reviewer',     'validation', '{scriptwriter}'),
  ('visual_director',      'Directeur visuel',        'Définit le style visuel et les bibles',               'creator',      'visual',     '{story_architect}'),
  ('scene_designer',       'Concepteur de scènes',    'Découpe les épisodes en scènes détaillées',           'creator',      'visual',     '{scriptwriter,visual_director}'),
  ('shot_planner',         'Planificateur de plans',  'Génère les shotlists à partir des scènes',            'creator',      'production', '{scene_designer}'),
  ('music_director',       'Directeur musical',       'Sélectionne et synchronise la musique',               'creator',      'audio',      '{story_architect}'),
  ('voice_director',       'Directeur voix',          'Gère le casting et la direction vocale',              'creator',      'audio',      '{dialogue_coach}'),
  ('editor',               'Monteur',                 'Supervise le montage et l''assemblage final',         'assembler',    'production', '{shot_planner}'),
  ('colorist',             'Étalonneur',              'Applique l''étalonnage et la cohérence couleur',      'refiner',      'visual',     '{editor}'),
  ('qa_reviewer',          'Contrôleur qualité',      'Revue finale avant livraison',                        'reviewer',     'validation', '{editor}'),
  ('delivery_manager',     'Responsable livraison',   'Gère les exports et la distribution',                 'assembler',    'delivery',   '{qa_reviewer}')
ON CONFLICT (slug) DO NOTHING;

-- Agent prompts (versioned)
CREATE TABLE IF NOT EXISTS public.agent_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug TEXT NOT NULL REFERENCES public.agent_registry(slug) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_slug, version)
);

ALTER TABLE public.agent_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read prompts" ON public.agent_prompts
  FOR SELECT USING (true);

CREATE POLICY "Admins manage prompts" ON public.agent_prompts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Agent runs (execution tracking)
CREATE TABLE IF NOT EXISTS public.agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug TEXT NOT NULL REFERENCES public.agent_registry(slug) ON DELETE CASCADE,
  episode_id UUID REFERENCES public.episodes(id) ON DELETE SET NULL,
  season_id UUID REFERENCES public.seasons(id) ON DELETE SET NULL,
  series_id UUID REFERENCES public.series(id) ON DELETE SET NULL,
  prompt_version INTEGER,
  status public.agent_run_status NOT NULL DEFAULT 'queued',
  input JSONB DEFAULT '{}',
  output JSONB,
  error_message TEXT,
  cost_credits INTEGER DEFAULT 0,
  latency_ms INTEGER,
  model_used TEXT,
  tokens_used INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent runs" ON public.agent_runs
  FOR SELECT TO authenticated
  USING (
    (series_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.series s
      JOIN public.projects p ON p.id = s.project_id
      WHERE s.id = agent_runs.series_id
        AND (p.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
    ))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE INDEX idx_agent_runs_episode ON public.agent_runs(episode_id);
CREATE INDEX idx_agent_runs_series ON public.agent_runs(series_id);
CREATE INDEX idx_agent_runs_status ON public.agent_runs(status);

-- Agent outputs (stored artifacts from runs)
CREATE TABLE IF NOT EXISTS public.agent_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  output_type TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  target_table TEXT,
  target_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent outputs" ON public.agent_outputs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.agent_runs ar
    WHERE ar.id = agent_outputs.agent_run_id AND (
      (ar.series_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.series s
        JOIN public.projects p ON p.id = s.project_id
        WHERE s.id = ar.series_id
          AND (p.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
      ))
      OR public.has_role(auth.uid(), 'admin')
    )
  ));

-- Extend job_queue for episode-level steps
ALTER TABLE public.job_queue ADD COLUMN IF NOT EXISTS episode_id UUID REFERENCES public.episodes(id) ON DELETE SET NULL;
ALTER TABLE public.job_queue ADD COLUMN IF NOT EXISTS agent_slug TEXT;
CREATE INDEX IF NOT EXISTS idx_job_queue_episode_id ON public.job_queue(episode_id);
