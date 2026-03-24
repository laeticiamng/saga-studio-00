-- Migration 1C: Bible system, character profiles, provider registry

-- Unified bible entries (polymorphic via bible_type)
CREATE TABLE IF NOT EXISTS public.bibles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  type public.bible_type NOT NULL,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  content JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bibles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bibles" ON public.bibles
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.series s
    JOIN public.projects p ON p.id = s.project_id
    WHERE s.id = bibles.series_id
      AND (p.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "Users can manage own bibles" ON public.bibles
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.series s
    JOIN public.projects p ON p.id = s.project_id
    WHERE s.id = bibles.series_id AND p.user_id = auth.uid()::text
  ));

CREATE INDEX idx_bibles_series_type ON public.bibles(series_id, type);

CREATE TRIGGER update_bibles_updated_at
  BEFORE UPDATE ON public.bibles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Character profiles
CREATE TABLE IF NOT EXISTS public.character_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  visual_description TEXT NOT NULL,
  personality JSONB DEFAULT '{}',
  arc JSONB DEFAULT '{}',
  relationships JSONB DEFAULT '[]',
  wardrobe JSONB DEFAULT '[]',
  voice_notes TEXT,
  reference_images JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.character_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own character profiles" ON public.character_profiles
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.series s
    JOIN public.projects p ON p.id = s.project_id
    WHERE s.id = character_profiles.series_id
      AND (p.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "Users can manage own character profiles" ON public.character_profiles
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.series s
    JOIN public.projects p ON p.id = s.project_id
    WHERE s.id = character_profiles.series_id AND p.user_id = auth.uid()::text
  ));

CREATE INDEX idx_character_profiles_series ON public.character_profiles(series_id);

CREATE TRIGGER update_character_profiles_updated_at
  BEFORE UPDATE ON public.character_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Character reference packs (images/videos for consistency)
CREATE TABLE IF NOT EXISTS public.character_reference_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES public.character_profiles(id) ON DELETE CASCADE,
  label TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT DEFAULT 'image',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.character_reference_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own character refs" ON public.character_reference_packs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.character_profiles cp
    JOIN public.series s ON s.id = cp.series_id
    JOIN public.projects p ON p.id = s.project_id
    WHERE cp.id = character_reference_packs.character_id
      AND (p.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "Users can manage own character refs" ON public.character_reference_packs
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.character_profiles cp
    JOIN public.series s ON s.id = cp.series_id
    JOIN public.projects p ON p.id = s.project_id
    WHERE cp.id = character_reference_packs.character_id AND p.user_id = auth.uid()::text
  ));

-- Provider registry
CREATE TABLE IF NOT EXISTS public.provider_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  capabilities JSONB NOT NULL DEFAULT '{}',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  health_status TEXT DEFAULT 'unknown',
  health_checked_at TIMESTAMPTZ,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.provider_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read providers" ON public.provider_registry
  FOR SELECT USING (true);

CREATE POLICY "Admins manage providers" ON public.provider_registry
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_provider_registry_updated_at
  BEFORE UPDATE ON public.provider_registry
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed providers
INSERT INTO public.provider_registry (name, display_name, provider_type, capabilities) VALUES
  ('openai_image', 'OpenAI DALL-E 3', 'image', '{"output":"image","sync":true,"max_prompt_chars":4000,"resolution":"1792x1024"}'),
  ('runway', 'Runway Gen-4.5', 'video', '{"output":"video","sync":false,"max_duration_sec":10,"max_prompt_chars":1000,"resolution":"1280x720"}'),
  ('luma', 'Luma Ray-2', 'video', '{"output":"video","sync":false,"max_duration_sec":10,"max_prompt_chars":2000,"resolution":"720p"}'),
  ('mock', 'Mock (Dev)', 'image', '{"output":"image","sync":true,"dev_only":true}')
ON CONFLICT (name) DO NOTHING;

-- Storage bucket for series assets
INSERT INTO storage.buckets (id, name, public) VALUES ('series-assets', 'series-assets', false) ON CONFLICT DO NOTHING;

CREATE POLICY "Users upload series assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'series-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users view own series assets" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'series-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
