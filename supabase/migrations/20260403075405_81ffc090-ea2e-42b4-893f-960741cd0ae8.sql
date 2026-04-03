
-- Add music_video to project_type enum
ALTER TYPE public.project_type ADD VALUE IF NOT EXISTS 'music_video';

-- Add music video specific columns
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS clip_type text DEFAULT NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS artist_presence text DEFAULT NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS quality_tier text DEFAULT 'standard';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS render_target text DEFAULT 'browser_allowed';
