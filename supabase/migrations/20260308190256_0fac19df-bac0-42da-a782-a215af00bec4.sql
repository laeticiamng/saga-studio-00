
-- 1. Add aspect_ratio, face_urls, ref_photo_urls columns to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS aspect_ratio text DEFAULT '16:9';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS face_urls jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS ref_photo_urls jsonb DEFAULT '[]'::jsonb;

-- 2. Activate handle_new_user trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Activate validate_render_completion trigger
DROP TRIGGER IF EXISTS validate_render_before_complete ON public.renders;
CREATE TRIGGER validate_render_before_complete
  BEFORE UPDATE ON public.renders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_render_completion();

-- 4. Performance indexes
CREATE INDEX IF NOT EXISTS idx_shots_project_id ON public.shots(project_id);
CREATE INDEX IF NOT EXISTS idx_shots_status ON public.shots(status);
CREATE INDEX IF NOT EXISTS idx_job_queue_project_id ON public.job_queue(project_id);
CREATE INDEX IF NOT EXISTS idx_job_queue_status ON public.job_queue(status);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_ref_id ON public.credit_ledger(ref_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_id ON public.credit_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_renders_project_id ON public.renders(project_id);

-- 5. Add FK constraints if missing (safe with IF NOT EXISTS pattern)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shots_project_id_fkey') THEN
    ALTER TABLE public.shots ADD CONSTRAINT shots_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'renders_project_id_fkey') THEN
    ALTER TABLE public.renders ADD CONSTRAINT renders_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plans_project_id_fkey') THEN
    ALTER TABLE public.plans ADD CONSTRAINT plans_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audio_analysis_project_id_fkey') THEN
    ALTER TABLE public.audio_analysis ADD CONSTRAINT audio_analysis_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_queue_project_id_fkey') THEN
    ALTER TABLE public.job_queue ADD CONSTRAINT job_queue_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 6. Public RLS policy for ShareView (completed renders + projects)
CREATE POLICY "Public can view completed renders"
  ON public.renders FOR SELECT TO anon
  USING (status = 'completed');

CREATE POLICY "Public can view completed projects basic info"
  ON public.projects FOR SELECT TO anon
  USING (status = 'completed');
