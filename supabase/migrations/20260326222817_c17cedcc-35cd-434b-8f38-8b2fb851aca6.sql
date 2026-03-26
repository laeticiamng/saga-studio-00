
-- ============================================================
-- SERIES INFRASTRUCTURE MIGRATION
-- Adds all missing tables for the series production pipeline
-- ============================================================

-- 1. Add 'series' to project_type enum
ALTER TYPE public.project_type ADD VALUE IF NOT EXISTS 'series';

-- 2. Add episode_id and agent_slug columns to job_queue (used by episode-pipeline)
ALTER TABLE public.job_queue ADD COLUMN IF NOT EXISTS episode_id uuid;
ALTER TABLE public.job_queue ADD COLUMN IF NOT EXISTS agent_slug text;

-- ============================================================
-- CORE SERIES TABLES
-- ============================================================

-- series
CREATE TABLE IF NOT EXISTS public.series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  logline text,
  genre text,
  tone text,
  target_audience text,
  total_seasons integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- seasons
CREATE TABLE IF NOT EXISTS public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  number integer NOT NULL,
  title text,
  arc_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- episodes
CREATE TABLE IF NOT EXISTS public.episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  number integer NOT NULL,
  title text NOT NULL DEFAULT 'Untitled',
  synopsis text,
  status text NOT NULL DEFAULT 'draft',
  workflow_run_id uuid,
  project_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- scenes
CREATE TABLE IF NOT EXISTS public.scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  idx integer NOT NULL DEFAULT 1,
  title text,
  description text,
  location text,
  time_of_day text,
  mood text,
  duration_target_sec real,
  characters jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- CONTENT TABLES
-- ============================================================

-- scripts
CREATE TABLE IF NOT EXISTS public.scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL UNIQUE REFERENCES public.episodes(id) ON DELETE CASCADE,
  current_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- script_versions
CREATE TABLE IF NOT EXISTS public.script_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  version integer NOT NULL,
  content text NOT NULL DEFAULT '',
  change_summary text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- bibles
CREATE TABLE IF NOT EXISTS public.bibles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'style',
  name text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- character_profiles
CREATE TABLE IF NOT EXISTS public.character_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  name text NOT NULL,
  visual_description text,
  personality text,
  relationships jsonb DEFAULT '[]'::jsonb,
  wardrobe text,
  voice_notes text,
  backstory text,
  arc text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- character_reference_packs
CREATE TABLE IF NOT EXISTS public.character_reference_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.character_profiles(id) ON DELETE CASCADE,
  image_urls jsonb DEFAULT '[]'::jsonb,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- AGENT TABLES
-- ============================================================

-- agent_registry
CREATE TABLE IF NOT EXISTS public.agent_registry (
  slug text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  role text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- agent_prompts
CREATE TABLE IF NOT EXISTS public.agent_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug text NOT NULL REFERENCES public.agent_registry(slug) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  content text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- agent_runs
CREATE TABLE IF NOT EXISTS public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug text NOT NULL REFERENCES public.agent_registry(slug),
  episode_id uuid REFERENCES public.episodes(id) ON DELETE SET NULL,
  series_id uuid REFERENCES public.series(id) ON DELETE SET NULL,
  season_id uuid REFERENCES public.seasons(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued',
  input jsonb DEFAULT '{}'::jsonb,
  output jsonb,
  error_message text,
  idempotency_key text UNIQUE,
  correlation_id text,
  started_at timestamptz,
  completed_at timestamptz,
  latency_ms integer,
  model_used text,
  tokens_used integer DEFAULT 0,
  prompt_version integer DEFAULT 0,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- agent_outputs
CREATE TABLE IF NOT EXISTS public.agent_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_run_id uuid NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  output_type text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- WORKFLOW TABLES
-- ============================================================

-- workflow_runs
CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  series_id uuid REFERENCES public.series(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  current_step_key text,
  correlation_id text,
  idempotency_key text UNIQUE,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- workflow_steps
CREATE TABLE IF NOT EXISTS public.workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_run_id uuid NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  step_order integer NOT NULL DEFAULT 1,
  label text,
  status text NOT NULL DEFAULT 'pending',
  agents text[] DEFAULT '{}',
  requires_approval boolean DEFAULT false,
  auto_advance_threshold real,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- workflow_step_runs (junction: step ↔ agent_run)
CREATE TABLE IF NOT EXISTS public.workflow_step_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_step_id uuid NOT NULL REFERENCES public.workflow_steps(id) ON DELETE CASCADE,
  agent_run_id uuid NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- workflow_approvals
CREATE TABLE IF NOT EXISTS public.workflow_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_step_id uuid NOT NULL REFERENCES public.workflow_steps(id) ON DELETE CASCADE,
  decision text NOT NULL DEFAULT 'pending',
  decided_by_user uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- workflow_confidence_scores
CREATE TABLE IF NOT EXISTS public.workflow_confidence_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_step_id uuid REFERENCES public.workflow_steps(id) ON DELETE SET NULL,
  agent_run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  episode_id uuid REFERENCES public.episodes(id) ON DELETE CASCADE,
  dimension text NOT NULL,
  score real NOT NULL DEFAULT 0,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- APPROVAL TABLES
-- ============================================================

-- approval_steps
CREATE TABLE IF NOT EXISTS public.approval_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  step_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewer_agent text,
  reviewer_user uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- approval_decisions
CREATE TABLE IF NOT EXISTS public.approval_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_step_id uuid NOT NULL REFERENCES public.approval_steps(id) ON DELETE CASCADE,
  decision text NOT NULL,
  reason text,
  decided_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- REVIEW TABLES
-- ============================================================

-- psychology_reviews
CREATE TABLE IF NOT EXISTS public.psychology_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  agent_run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  character_assessments jsonb DEFAULT '[]'::jsonb,
  verdict text NOT NULL DEFAULT 'pass',
  recommendations text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- legal_ethics_reviews
CREATE TABLE IF NOT EXISTS public.legal_ethics_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  agent_run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  flags jsonb DEFAULT '[]'::jsonb,
  verdict text NOT NULL DEFAULT 'pass',
  recommendations text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- continuity_reports
CREATE TABLE IF NOT EXISTS public.continuity_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  agent_run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  issues jsonb DEFAULT '[]'::jsonb,
  verdict text NOT NULL DEFAULT 'pass',
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- CONTINUITY MEMORY GRAPH
-- ============================================================

-- continuity_memory_nodes
CREATE TABLE IF NOT EXISTS public.continuity_memory_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  node_type text NOT NULL DEFAULT 'event',
  label text NOT NULL,
  properties jsonb DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  first_appearance_episode uuid REFERENCES public.episodes(id) ON DELETE SET NULL,
  last_updated_episode uuid REFERENCES public.episodes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- continuity_memory_edges
CREATE TABLE IF NOT EXISTS public.continuity_memory_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  source_node_id uuid NOT NULL REFERENCES public.continuity_memory_nodes(id) ON DELETE CASCADE,
  target_node_id uuid NOT NULL REFERENCES public.continuity_memory_nodes(id) ON DELETE CASCADE,
  edge_type text NOT NULL DEFAULT 'related',
  properties jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- continuity_conflicts
CREATE TABLE IF NOT EXISTS public.continuity_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  episode_id uuid REFERENCES public.episodes(id) ON DELETE SET NULL,
  conflict_type text NOT NULL DEFAULT 'visual_mismatch',
  severity text NOT NULL DEFAULT 'warning',
  description text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- COMPLIANCE TABLES
-- ============================================================

-- brand_safety_flags
CREATE TABLE IF NOT EXISTS public.brand_safety_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'general',
  severity text NOT NULL DEFAULT 'warning',
  description text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- redaction_profiles
CREATE TABLE IF NOT EXISTS public.redaction_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- redaction_rules
CREATE TABLE IF NOT EXISTS public.redaction_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.redaction_profiles(id) ON DELETE CASCADE,
  rule_type text NOT NULL,
  pattern text,
  action text NOT NULL DEFAULT 'flag',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- redaction_runs
CREATE TABLE IF NOT EXISTS public.redaction_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.redaction_profiles(id) ON DELETE CASCADE,
  episode_id uuid NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  applied_rules jsonb DEFAULT '[]'::jsonb,
  issues_found integer DEFAULT 0,
  issues_resolved integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- redaction_reports
CREATE TABLE IF NOT EXISTS public.redaction_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  redaction_run_id uuid NOT NULL REFERENCES public.redaction_runs(id) ON DELETE CASCADE,
  findings jsonb DEFAULT '[]'::jsonb,
  verdict text NOT NULL DEFAULT 'pass',
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- DELIVERY TABLES
-- ============================================================

-- delivery_manifests
CREATE TABLE IF NOT EXISTS public.delivery_manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  episode_id uuid REFERENCES public.episodes(id) ON DELETE SET NULL,
  manifest_type text NOT NULL DEFAULT 'episode',
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(series_id, episode_id)
);

-- qc_reports
CREATE TABLE IF NOT EXISTS public.qc_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_manifest_id uuid REFERENCES public.delivery_manifests(id) ON DELETE SET NULL,
  episode_id uuid REFERENCES public.episodes(id) ON DELETE CASCADE,
  checks jsonb DEFAULT '[]'::jsonb,
  overall_verdict text NOT NULL DEFAULT 'pending',
  blocking_issues jsonb DEFAULT '[]'::jsonb,
  warnings jsonb DEFAULT '[]'::jsonb,
  score real DEFAULT 0,
  checked_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- export_jobs
CREATE TABLE IF NOT EXISTS public.export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  episode_id uuid REFERENCES public.episodes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  format text NOT NULL DEFAULT 'mp4',
  output_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- asset_packs
CREATE TABLE IF NOT EXISTS public.asset_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  episode_id uuid REFERENCES public.episodes(id) ON DELETE SET NULL,
  pack_type text NOT NULL DEFAULT 'full',
  manifest jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- SYSTEM TABLES
-- ============================================================

-- feature_flags
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- provider_registry
CREATE TABLE IF NOT EXISTS public.provider_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  provider_type text NOT NULL DEFAULT 'video',
  api_base_url text,
  is_active boolean NOT NULL DEFAULT true,
  capabilities jsonb DEFAULT '{}'::jsonb,
  cost_per_second real DEFAULT 0,
  max_duration_sec integer DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Enable RLS on all new tables
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_reference_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_step_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_confidence_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psychology_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_ethics_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.continuity_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.continuity_memory_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.continuity_memory_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.continuity_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_safety_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redaction_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redaction_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redaction_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redaction_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_registry ENABLE ROW LEVEL SECURITY;

-- Helper: check if user owns the project behind a series
CREATE OR REPLACE FUNCTION public.user_owns_series(p_series_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.series s
    JOIN public.projects p ON p.id = s.project_id
    WHERE s.id = p_series_id AND p.user_id = auth.uid()
  )
$$;

-- SERIES: owner can CRUD
CREATE POLICY "Users can view own series" ON public.series FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = series.project_id AND (projects.user_id = auth.uid() OR has_role(auth.uid(), 'admin'))));
CREATE POLICY "Users can insert own series" ON public.series FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = series.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can update own series" ON public.series FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = series.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can delete own series" ON public.series FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = series.project_id AND projects.user_id = auth.uid()));

-- SEASONS: owner via series
CREATE POLICY "Users can view own seasons" ON public.seasons FOR SELECT TO authenticated
  USING (user_owns_series(series_id) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own seasons" ON public.seasons FOR INSERT TO authenticated
  WITH CHECK (user_owns_series(series_id));
CREATE POLICY "Users can update own seasons" ON public.seasons FOR UPDATE TO authenticated
  USING (user_owns_series(series_id));
CREATE POLICY "Users can delete own seasons" ON public.seasons FOR DELETE TO authenticated
  USING (user_owns_series(series_id));

-- EPISODES: owner via season→series
CREATE POLICY "Users can view own episodes" ON public.episodes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM seasons s WHERE s.id = episodes.season_id AND user_owns_series(s.series_id)) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own episodes" ON public.episodes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM seasons s WHERE s.id = episodes.season_id AND user_owns_series(s.series_id)));
CREATE POLICY "Users can update own episodes" ON public.episodes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM seasons s WHERE s.id = episodes.season_id AND user_owns_series(s.series_id)));
CREATE POLICY "Users can delete own episodes" ON public.episodes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM seasons s WHERE s.id = episodes.season_id AND user_owns_series(s.series_id)));

-- SCENES: owner via episode→season→series
CREATE POLICY "Users can view own scenes" ON public.scenes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM episodes e JOIN seasons s ON s.id = e.season_id WHERE e.id = scenes.episode_id AND user_owns_series(s.series_id)) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own scenes" ON public.scenes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM episodes e JOIN seasons s ON s.id = e.season_id WHERE e.id = scenes.episode_id AND user_owns_series(s.series_id)));
CREATE POLICY "Users can update own scenes" ON public.scenes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM episodes e JOIN seasons s ON s.id = e.season_id WHERE e.id = scenes.episode_id AND user_owns_series(s.series_id)));

-- SCRIPTS: owner via episode
CREATE POLICY "Users can view own scripts" ON public.scripts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM episodes e JOIN seasons s ON s.id = e.season_id WHERE e.id = scripts.episode_id AND user_owns_series(s.series_id)) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own scripts" ON public.scripts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM episodes e JOIN seasons s ON s.id = e.season_id WHERE e.id = scripts.episode_id AND user_owns_series(s.series_id)));
CREATE POLICY "Users can update own scripts" ON public.scripts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM episodes e JOIN seasons s ON s.id = e.season_id WHERE e.id = scripts.episode_id AND user_owns_series(s.series_id)));

-- SCRIPT_VERSIONS: owner via script→episode
CREATE POLICY "Users can view own script_versions" ON public.script_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM scripts sc JOIN episodes e ON e.id = sc.episode_id JOIN seasons s ON s.id = e.season_id WHERE sc.id = script_versions.script_id AND user_owns_series(s.series_id)) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own script_versions" ON public.script_versions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM scripts sc JOIN episodes e ON e.id = sc.episode_id JOIN seasons s ON s.id = e.season_id WHERE sc.id = script_versions.script_id AND user_owns_series(s.series_id)));

-- BIBLES: owner via series
CREATE POLICY "Users can view own bibles" ON public.bibles FOR SELECT TO authenticated
  USING (user_owns_series(series_id) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own bibles" ON public.bibles FOR INSERT TO authenticated
  WITH CHECK (user_owns_series(series_id));
CREATE POLICY "Users can update own bibles" ON public.bibles FOR UPDATE TO authenticated
  USING (user_owns_series(series_id));
CREATE POLICY "Users can delete own bibles" ON public.bibles FOR DELETE TO authenticated
  USING (user_owns_series(series_id));

-- CHARACTER_PROFILES: owner via series
CREATE POLICY "Users can view own character_profiles" ON public.character_profiles FOR SELECT TO authenticated
  USING (user_owns_series(series_id) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own character_profiles" ON public.character_profiles FOR INSERT TO authenticated
  WITH CHECK (user_owns_series(series_id));
CREATE POLICY "Users can update own character_profiles" ON public.character_profiles FOR UPDATE TO authenticated
  USING (user_owns_series(series_id));
CREATE POLICY "Users can delete own character_profiles" ON public.character_profiles FOR DELETE TO authenticated
  USING (user_owns_series(series_id));

-- CHARACTER_REFERENCE_PACKS: owner via character→series
CREATE POLICY "Users can view own reference_packs" ON public.character_reference_packs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM character_profiles cp WHERE cp.id = character_reference_packs.character_id AND user_owns_series(cp.series_id)) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own reference_packs" ON public.character_reference_packs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM character_profiles cp WHERE cp.id = character_reference_packs.character_id AND user_owns_series(cp.series_id)));

-- AGENT_REGISTRY: public read
CREATE POLICY "Anyone can view agent_registry" ON public.agent_registry FOR SELECT TO authenticated USING (true);

-- AGENT_PROMPTS: public read
CREATE POLICY "Anyone can view agent_prompts" ON public.agent_prompts FOR SELECT TO authenticated USING (true);

-- AGENT_RUNS: owner via episode or series
CREATE POLICY "Users can view own agent_runs" ON public.agent_runs FOR SELECT TO authenticated
  USING (
    (episode_id IS NOT NULL AND EXISTS (SELECT 1 FROM episodes e JOIN seasons s ON s.id = e.season_id WHERE e.id = agent_runs.episode_id AND user_owns_series(s.series_id)))
    OR (series_id IS NOT NULL AND user_owns_series(series_id))
    OR has_role(auth.uid(), 'admin')
  );

-- AGENT_OUTPUTS: owner via agent_run
CREATE POLICY "Users can view own agent_outputs" ON public.agent_outputs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM agent_runs ar WHERE ar.id = agent_outputs.agent_run_id AND (
    (ar.series_id IS NOT NULL AND user_owns_series(ar.series_id))
    OR has_role(auth.uid(), 'admin')
  )));

-- WORKFLOW_RUNS: owner via episode
CREATE POLICY "Users can view own workflow_runs" ON public.workflow_runs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM episodes e JOIN seasons s ON s.id = e.season_id WHERE e.id = workflow_runs.episode_id AND user_owns_series(s.series_id)) OR has_role(auth.uid(), 'admin'));

-- WORKFLOW_STEPS: owner via workflow_run
CREATE POLICY "Users can view own workflow_steps" ON public.workflow_steps FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workflow_runs wr JOIN episodes e ON e.id = wr.episode_id JOIN seasons s ON s.id = e.season_id WHERE wr.id = workflow_steps.workflow_run_id AND user_owns_series(s.series_id)) OR has_role(auth.uid(), 'admin'));

-- WORKFLOW_STEP_RUNS: via workflow_step
CREATE POLICY "Users can view own step_runs" ON public.workflow_step_runs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workflow_steps ws JOIN workflow_runs wr ON wr.id = ws.workflow_run_id JOIN episodes e ON e.id = wr.episode_id JOIN seasons s ON s.id = e.season_id WHERE ws.id = workflow_step_runs.workflow_step_id AND user_owns_series(s.series_id)) OR has_role(auth.uid(), 'admin'));

-- WORKFLOW_APPROVALS: via workflow_step
CREATE POLICY "Users can view own workflow_approvals" ON public.workflow_approvals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workflow_steps ws JOIN workflow_runs wr ON wr.id = ws.workflow_run_id JOIN episodes e ON e.id = wr.episode_id JOIN seasons s ON s.id = e.season_id WHERE ws.id = workflow_approvals.workflow_step_id AND user_owns_series(s.series_id)) OR has_role(auth.uid(), 'admin'));

-- WORKFLOW_CONFIDENCE_SCORES: owner via episode
CREATE POLICY "Users can view own confidence_scores" ON public.workflow_confidence_scores FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM episodes e JOIN seasons s ON s.id = e.season_id WHERE e.id = workflow_confidence_scores.episode_id AND user_owns_series(s.series_id)) OR has_role(auth.uid(), 'admin'));

-- APPROVAL_STEPS: owner via episode
CREATE POLICY "Users can view own approval_steps" ON public.approval_steps FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM episodes e JOIN seasons s ON s.id = e.season_id WHERE e.id = approval_steps.episode_id AND user_owns_series(s.series_id)) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own approval_steps" ON public.approval_steps FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM episodes e JOIN seasons s ON s.id = e.season_id WHERE e.id = approval_steps.episode_id AND user_owns_series(s.series_id)));

-- APPROVAL_DECISIONS: owner via approval_step
CREATE POLICY "Users can view own approval_decisions" ON public.approval_decisions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM approval_steps ast JOIN episodes e ON e.id = ast.episode_id JOIN seasons s ON s.id = e.season_id WHERE ast.id = approval_decisions.approval_step_id AND user_owns_series(s.series_id)) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own approval_decisions" ON public.approval_decisions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM approval_steps ast JOIN episodes e ON e.id = ast.episode_id JOIN seasons s ON s.id = e.season_id WHERE ast.id = approval_decisions.approval_step_id AND user_owns_series(s.series_id)));

-- REVIEW TABLES: owner via episode
CREATE POLICY "Users can view own psychology_reviews" ON public.psychology_reviews FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM episodes e JOIN seasons s ON s.id = e.season_id WHERE e.id = psychology_reviews.episode_id AND user_owns_series(s.series_id)) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own legal_ethics_reviews" ON public.legal_ethics_reviews FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM episodes e JOIN seasons s ON s.id = e.season_id WHERE e.id = legal_ethics_reviews.episode_id AND user_owns_series(s.series_id)) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own continuity_reports" ON public.continuity_reports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM episodes e JOIN seasons s ON s.id = e.season_id WHERE e.id = continuity_reports.episode_id AND user_owns_series(s.series_id)) OR has_role(auth.uid(), 'admin'));

-- CONTINUITY MEMORY: owner via series
CREATE POLICY "Users can view own memory_nodes" ON public.continuity_memory_nodes FOR SELECT TO authenticated
  USING (user_owns_series(series_id) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own memory_edges" ON public.continuity_memory_edges FOR SELECT TO authenticated
  USING (user_owns_series(series_id) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own continuity_conflicts" ON public.continuity_conflicts FOR SELECT TO authenticated
  USING (user_owns_series(series_id) OR has_role(auth.uid(), 'admin'));

-- COMPLIANCE: owner via episode or series
CREATE POLICY "Users can view own brand_safety_flags" ON public.brand_safety_flags FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM episodes e JOIN seasons s ON s.id = e.season_id WHERE e.id = brand_safety_flags.episode_id AND user_owns_series(s.series_id)) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own redaction_profiles" ON public.redaction_profiles FOR SELECT TO authenticated
  USING (user_owns_series(series_id) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own redaction_rules" ON public.redaction_rules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM redaction_profiles rp WHERE rp.id = redaction_rules.profile_id AND user_owns_series(rp.series_id)) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own redaction_runs" ON public.redaction_runs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM episodes e JOIN seasons s ON s.id = e.season_id WHERE e.id = redaction_runs.episode_id AND user_owns_series(s.series_id)) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own redaction_reports" ON public.redaction_reports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM redaction_runs rr JOIN episodes e ON e.id = rr.episode_id JOIN seasons s ON s.id = e.season_id WHERE rr.id = redaction_reports.redaction_run_id AND user_owns_series(s.series_id)) OR has_role(auth.uid(), 'admin'));

-- DELIVERY: owner via series
CREATE POLICY "Users can view own delivery_manifests" ON public.delivery_manifests FOR SELECT TO authenticated
  USING (user_owns_series(series_id) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own qc_reports" ON public.qc_reports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM episodes e JOIN seasons s ON s.id = e.season_id WHERE e.id = qc_reports.episode_id AND user_owns_series(s.series_id)) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own export_jobs" ON public.export_jobs FOR SELECT TO authenticated
  USING (user_owns_series(series_id) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own asset_packs" ON public.asset_packs FOR SELECT TO authenticated
  USING (user_owns_series(series_id) OR has_role(auth.uid(), 'admin'));

-- FEATURE_FLAGS: public read
CREATE POLICY "Anyone can view feature_flags" ON public.feature_flags FOR SELECT USING (true);

-- AUDIT_LOGS: own logs only
CREATE POLICY "Users can view own audit_logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- PROVIDER_REGISTRY: public read
CREATE POLICY "Anyone can view provider_registry" ON public.provider_registry FOR SELECT USING (true);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_series_project_id ON public.series(project_id);
CREATE INDEX IF NOT EXISTS idx_seasons_series_id ON public.seasons(series_id);
CREATE INDEX IF NOT EXISTS idx_episodes_season_id ON public.episodes(season_id);
CREATE INDEX IF NOT EXISTS idx_scenes_episode_id ON public.scenes(episode_id);
CREATE INDEX IF NOT EXISTS idx_scripts_episode_id ON public.scripts(episode_id);
CREATE INDEX IF NOT EXISTS idx_bibles_series_id ON public.bibles(series_id);
CREATE INDEX IF NOT EXISTS idx_character_profiles_series_id ON public.character_profiles(series_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_episode_id ON public.agent_runs(episode_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_series_id ON public.agent_runs(series_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_idempotency ON public.agent_runs(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_episode_id ON public.workflow_runs(episode_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_run_id ON public.workflow_steps(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_approval_steps_episode_id ON public.approval_steps(episode_id);
CREATE INDEX IF NOT EXISTS idx_continuity_nodes_series ON public.continuity_memory_nodes(series_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
