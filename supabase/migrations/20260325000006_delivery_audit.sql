-- Migration 5A: Delivery and audit tables

-- Render batches (batch rendering across episodes)
CREATE TABLE IF NOT EXISTS public.render_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  season_id UUID REFERENCES public.seasons(id) ON DELETE SET NULL,
  status public.render_status NOT NULL DEFAULT 'pending',
  episode_ids JSONB NOT NULL DEFAULT '[]',
  config JSONB DEFAULT '{}',
  progress JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.render_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own render batches" ON public.render_batches
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.series s
    JOIN public.projects p ON p.id = s.project_id
    WHERE s.id = render_batches.series_id
      AND (p.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "Users can manage own render batches" ON public.render_batches
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.series s
    JOIN public.projects p ON p.id = s.project_id
    WHERE s.id = render_batches.series_id AND p.user_id = auth.uid()::text
  ));

CREATE TRIGGER update_render_batches_updated_at
  BEFORE UPDATE ON public.render_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Asset packs (deliverables)
CREATE TABLE IF NOT EXISTS public.asset_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES public.episodes(id) ON DELETE SET NULL,
  pack_type TEXT NOT NULL DEFAULT 'full',
  file_url TEXT,
  manifest JSONB DEFAULT '{}',
  status public.render_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own asset packs" ON public.asset_packs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.series s
    JOIN public.projects p ON p.id = s.project_id
    WHERE s.id = asset_packs.series_id
      AND (p.user_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE TRIGGER update_asset_packs_updated_at
  BEFORE UPDATE ON public.asset_packs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at);
