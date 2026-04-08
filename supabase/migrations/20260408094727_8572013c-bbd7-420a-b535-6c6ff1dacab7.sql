-- Add quality_tier column to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS quality_tier text NOT NULL DEFAULT 'standard';

-- Add a comment for documentation
COMMENT ON COLUMN public.projects.quality_tier IS 'Quality tier: premium, standard, or economy. Controls provider selection and rendering mode.';
