-- Migration 1A: Core enums and feature flags for Series Studio

-- New enums
DO $$ BEGIN
  CREATE TYPE public.episode_status AS ENUM (
    'draft', 'story_development', 'psychology_review', 'legal_ethics_review',
    'visual_bible', 'continuity_check', 'shot_generation', 'shot_review',
    'assembly', 'edit_review', 'delivery', 'completed', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.bible_type AS ENUM (
    'style', 'character', 'wardrobe', 'location', 'world', 'music', 'voice', 'prop'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.approval_status AS ENUM (
    'pending', 'approved', 'rejected', 'revision_requested'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.agent_status AS ENUM (
    'active', 'inactive', 'deprecated'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.agent_run_status AS ENUM (
    'queued', 'running', 'completed', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.review_verdict AS ENUM (
    'pass', 'flag', 'block'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extend project_type: add 'series'
ALTER TYPE public.project_type ADD VALUE IF NOT EXISTS 'series';

-- Extend project_status: add 'in_production'
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'in_production';

-- Feature flags table
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read flags" ON public.feature_flags
  FOR SELECT USING (true);

CREATE POLICY "Admins manage flags" ON public.feature_flags
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed feature flags
INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('series_enabled', false, 'Enable series creation and management'),
  ('agent_system_enabled', false, 'Enable AI agent orchestration'),
  ('review_workflows_enabled', false, 'Enable psychology/legal/continuity reviews')
ON CONFLICT (key) DO NOTHING;
