
-- 1. ENUMS (skip if already exist from failed migration)
DO $$ BEGIN CREATE TYPE public.project_type AS ENUM ('clip', 'film'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.project_status AS ENUM ('draft', 'analyzing', 'planning', 'generating', 'stitching', 'completed', 'failed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.shot_status AS ENUM ('pending', 'generating', 'completed', 'failed', 'regenerating'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.render_status AS ENUM ('pending', 'processing', 'completed', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.job_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.moderation_status AS ENUM ('pending', 'reviewed', 'resolved', 'dismissed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. USER ROLES TABLE (must exist before has_role function)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. has_role function (now table exists)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can manage roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can update roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- 5. CREDIT WALLETS
CREATE TABLE IF NOT EXISTS public.credit_wallets (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 10,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own wallet" ON public.credit_wallets FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System updates wallets" ON public.credit_wallets FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 6. CREDIT LEDGER
CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref_type TEXT,
  ref_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own ledger" ON public.credit_ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 7. PROJECTS
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type project_type NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled',
  status project_status NOT NULL DEFAULT 'draft',
  provider_default TEXT DEFAULT 'sora2',
  mode TEXT,
  style_preset TEXT,
  duration_sec INTEGER,
  audio_url TEXT,
  synopsis TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create own projects" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 8. AUDIO ANALYSIS
CREATE TABLE IF NOT EXISTS public.audio_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  bpm REAL,
  beats_json JSONB DEFAULT '[]',
  sections_json JSONB DEFAULT '[]',
  energy_json JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audio_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own audio analysis" ON public.audio_analysis FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = audio_analysis.project_id AND (projects.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "System can insert audio analysis" ON public.audio_analysis FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = audio_analysis.project_id AND projects.user_id = auth.uid()));

-- 9. PLANS
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  style_bible_json JSONB DEFAULT '{}',
  character_bible_json JSONB DEFAULT '{}',
  shotlist_json JSONB DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own plans" ON public.plans FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = plans.project_id AND (projects.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "System can insert plans" ON public.plans FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = plans.project_id AND projects.user_id = auth.uid()));

-- 10. SHOTS
CREATE TABLE IF NOT EXISTS public.shots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  provider TEXT,
  prompt TEXT,
  negative_prompt TEXT,
  duration_sec REAL DEFAULT 8,
  seed INTEGER,
  status shot_status NOT NULL DEFAULT 'pending',
  output_url TEXT,
  cost_credits INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own shots" ON public.shots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = shots.project_id AND (projects.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "System can manage shots" ON public.shots FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = shots.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "System can update shots" ON public.shots FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = shots.project_id AND (projects.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- 11. RENDERS
CREATE TABLE IF NOT EXISTS public.renders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  master_url_16_9 TEXT,
  master_url_9_16 TEXT,
  teaser_url TEXT,
  thumbs_json JSONB DEFAULT '[]',
  status render_status NOT NULL DEFAULT 'pending',
  logs TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.renders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own renders" ON public.renders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = renders.project_id AND (projects.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- 12. MODERATION FLAGS
CREATE TABLE IF NOT EXISTS public.moderation_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status moderation_status NOT NULL DEFAULT 'pending',
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.moderation_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage flags" ON public.moderation_flags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view flags on own projects" ON public.moderation_flags FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = moderation_flags.project_id AND projects.user_id = auth.uid()));

-- 13. JOB QUEUE
CREATE TABLE IF NOT EXISTS public.job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  status job_status NOT NULL DEFAULT 'pending',
  payload JSONB DEFAULT '{}',
  result JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view job queue" ON public.job_queue FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 14. TRIGGERS
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_credit_wallets_updated_at BEFORE UPDATE ON public.credit_wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_shots_updated_at BEFORE UPDATE ON public.shots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_renders_updated_at BEFORE UPDATE ON public.renders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_moderation_flags_updated_at BEFORE UPDATE ON public.moderation_flags FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_job_queue_updated_at BEFORE UPDATE ON public.job_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 15. AUTO-CREATE PROFILE + WALLET + ROLE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.credit_wallets (id, balance) VALUES (NEW.id, 10);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 16. INDEXES
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_shots_project_id ON public.shots(project_id);
CREATE INDEX idx_shots_status ON public.shots(status);
CREATE INDEX idx_credit_ledger_user_id ON public.credit_ledger(user_id);
CREATE INDEX idx_job_queue_status ON public.job_queue(status);
CREATE INDEX idx_job_queue_project_id ON public.job_queue(project_id);

-- 17. STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public) VALUES ('audio-uploads', 'audio-uploads', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('face-references', 'face-references', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('shot-outputs', 'shot-outputs', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('renders', 'renders', true);

-- Storage policies
CREATE POLICY "Users upload audio" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'audio-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users view own audio" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'audio-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own audio" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'audio-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload face refs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'face-references' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users view own face refs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'face-references' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Public view shot outputs" ON storage.objects FOR SELECT
  USING (bucket_id = 'shot-outputs');
CREATE POLICY "Users upload shot outputs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shot-outputs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Public view renders" ON storage.objects FOR SELECT
  USING (bucket_id = 'renders');
CREATE POLICY "Users upload renders" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'renders' AND auth.uid()::text = (storage.foldername(name))[1]);
