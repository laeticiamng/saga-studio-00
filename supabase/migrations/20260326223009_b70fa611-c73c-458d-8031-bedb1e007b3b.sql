
-- Add missing columns referenced by UI and edge functions

-- provider_registry: add display_name, is_enabled, health_status, health_checked_at
ALTER TABLE public.provider_registry ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.provider_registry ADD COLUMN IF NOT EXISTS is_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.provider_registry ADD COLUMN IF NOT EXISTS health_status text DEFAULT 'unknown';
ALTER TABLE public.provider_registry ADD COLUMN IF NOT EXISTS health_checked_at timestamptz;

-- Update existing providers with display names
UPDATE public.provider_registry SET display_name = 'OpenAI Sora 2 (Vidéo)' WHERE name = 'sora2';
UPDATE public.provider_registry SET display_name = 'Runway Gen-4 (Vidéo)' WHERE name = 'runway';
UPDATE public.provider_registry SET display_name = 'Luma Dream Machine (Vidéo)' WHERE name = 'luma';
UPDATE public.provider_registry SET display_name = 'Google Veo 3.1 (Vidéo)' WHERE name = 'veo';

-- agent_registry: add status and dependencies columns (UI references agent.id, agent.status, agent.dependencies)
-- Note: slug is the PK; UI uses agent.id which maps to slug via the grid key
ALTER TABLE public.agent_registry ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.agent_registry ADD COLUMN IF NOT EXISTS dependencies text[] DEFAULT '{}';

-- export_jobs: add export_type column referenced by DeliveryCenter UI
ALTER TABLE public.export_jobs ADD COLUMN IF NOT EXISTS export_type text NOT NULL DEFAULT 'episode';
