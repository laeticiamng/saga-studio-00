
-- ============================================================
-- Phase 1: Production Studio Schema Foundation
-- ============================================================

-- Helper: ownership check for projects
CREATE OR REPLACE FUNCTION public.user_owns_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND user_id = auth.uid()
  )
$$;

-- ── 1. Continuity Groups ────────────────────────────────────
CREATE TABLE public.continuity_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid REFERENCES public.series(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default',
  description text,
  preset_refs jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT continuity_group_has_parent CHECK (series_id IS NOT NULL OR project_id IS NOT NULL)
);

ALTER TABLE public.continuity_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own continuity_groups" ON public.continuity_groups
  FOR SELECT TO authenticated
  USING (
    (project_id IS NOT NULL AND user_owns_project(project_id))
    OR (series_id IS NOT NULL AND user_owns_series(series_id))
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Users can insert own continuity_groups" ON public.continuity_groups
  FOR INSERT TO authenticated
  WITH CHECK (
    (project_id IS NOT NULL AND user_owns_project(project_id))
    OR (series_id IS NOT NULL AND user_owns_series(series_id))
  );

CREATE POLICY "Users can update own continuity_groups" ON public.continuity_groups
  FOR UPDATE TO authenticated
  USING (
    (project_id IS NOT NULL AND user_owns_project(project_id))
    OR (series_id IS NOT NULL AND user_owns_series(series_id))
  );

CREATE POLICY "Users can delete own continuity_groups" ON public.continuity_groups
  FOR DELETE TO authenticated
  USING (
    (project_id IS NOT NULL AND user_owns_project(project_id))
    OR (series_id IS NOT NULL AND user_owns_series(series_id))
  );

CREATE TRIGGER update_continuity_groups_updated_at
  BEFORE UPDATE ON public.continuity_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add continuity_group_id to scenes
ALTER TABLE public.scenes ADD COLUMN IF NOT EXISTS continuity_group_id uuid REFERENCES public.continuity_groups(id) ON DELETE SET NULL;

-- ── 2. Project Assets ───────────────────────────────────────
CREATE TABLE public.project_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  asset_type text NOT NULL DEFAULT 'image',
  source_provider text,
  source_model text,
  url text,
  storage_path text,
  metadata jsonb DEFAULT '{}'::jsonb,
  tags text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_assets_project ON public.project_assets(project_id);
CREATE INDEX idx_project_assets_type ON public.project_assets(asset_type);

ALTER TABLE public.project_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project_assets" ON public.project_assets
  FOR SELECT TO authenticated
  USING (user_owns_project(project_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own project_assets" ON public.project_assets
  FOR INSERT TO authenticated
  WITH CHECK (user_owns_project(project_id));

CREATE POLICY "Users can update own project_assets" ON public.project_assets
  FOR UPDATE TO authenticated
  USING (user_owns_project(project_id));

CREATE POLICY "Users can delete own project_assets" ON public.project_assets
  FOR DELETE TO authenticated
  USING (user_owns_project(project_id));

-- ── 3. Timelines ────────────────────────────────────────────
CREATE TABLE public.timelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  episode_id uuid REFERENCES public.episodes(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  name text NOT NULL DEFAULT 'Rough Cut',
  status text NOT NULL DEFAULT 'draft',
  duration_ms bigint DEFAULT 0,
  fps integer DEFAULT 24,
  look_preset text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, episode_id, version)
);

CREATE INDEX idx_timelines_project ON public.timelines(project_id);

ALTER TABLE public.timelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own timelines" ON public.timelines
  FOR SELECT TO authenticated
  USING (user_owns_project(project_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own timelines" ON public.timelines
  FOR INSERT TO authenticated
  WITH CHECK (user_owns_project(project_id));

CREATE POLICY "Users can update own timelines" ON public.timelines
  FOR UPDATE TO authenticated
  USING (user_owns_project(project_id));

CREATE POLICY "Users can delete own timelines" ON public.timelines
  FOR DELETE TO authenticated
  USING (user_owns_project(project_id));

CREATE TRIGGER update_timelines_updated_at
  BEFORE UPDATE ON public.timelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 4. Timeline Tracks ──────────────────────────────────────
CREATE TABLE public.timeline_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id uuid NOT NULL REFERENCES public.timelines(id) ON DELETE CASCADE,
  track_type text NOT NULL DEFAULT 'video',
  idx integer NOT NULL DEFAULT 0,
  label text NOT NULL DEFAULT 'Video',
  muted boolean DEFAULT false,
  locked boolean DEFAULT false,
  volume real DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_track_type CHECK (track_type IN ('video', 'dialogue', 'music', 'fx', 'subtitles'))
);

CREATE INDEX idx_timeline_tracks_timeline ON public.timeline_tracks(timeline_id);

ALTER TABLE public.timeline_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own timeline_tracks" ON public.timeline_tracks
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.timelines t
    WHERE t.id = timeline_tracks.timeline_id AND user_owns_project(t.project_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.timelines t
    WHERE t.id = timeline_tracks.timeline_id AND user_owns_project(t.project_id)
  ));

-- ── 5. Timeline Clips ───────────────────────────────────────
CREATE TABLE public.timeline_clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES public.timeline_tracks(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.project_assets(id) ON DELETE SET NULL,
  scene_id uuid REFERENCES public.scenes(id) ON DELETE SET NULL,
  shot_id uuid,
  episode_shot_id uuid REFERENCES public.episode_shots(id) ON DELETE SET NULL,
  name text,
  start_time_ms bigint NOT NULL DEFAULT 0,
  end_time_ms bigint NOT NULL DEFAULT 5000,
  in_trim_ms bigint DEFAULT 0,
  out_trim_ms bigint DEFAULT 0,
  source_url text,
  provider text,
  model text,
  locked boolean DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_timeline_clips_track ON public.timeline_clips(track_id);
CREATE INDEX idx_timeline_clips_scene ON public.timeline_clips(scene_id);

ALTER TABLE public.timeline_clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own timeline_clips" ON public.timeline_clips
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.timeline_tracks tr
    JOIN public.timelines t ON t.id = tr.timeline_id
    WHERE tr.id = timeline_clips.track_id AND user_owns_project(t.project_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.timeline_tracks tr
    JOIN public.timelines t ON t.id = tr.timeline_id
    WHERE tr.id = timeline_clips.track_id AND user_owns_project(t.project_id)
  ));

CREATE TRIGGER update_timeline_clips_updated_at
  BEFORE UPDATE ON public.timeline_clips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 6. Review Gates ─────────────────────────────────────────
CREATE TABLE public.review_gates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  episode_id uuid REFERENCES public.episodes(id) ON DELETE CASCADE,
  scene_id uuid REFERENCES public.scenes(id) ON DELETE SET NULL,
  gate_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  decision_action text,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_gate_type CHECK (gate_type IN (
    'character_pack', 'world_pack', 'scene_plan', 'clips', 
    'rough_cut', 'fine_cut', 'final_export', 'hero_shots',
    'performance', 'repair', 'social_exports', 'poster'
  )),
  CONSTRAINT valid_gate_status CHECK (status IN (
    'pending', 'approved', 'rejected', 'regenerating', 'skipped'
  ))
);

CREATE INDEX idx_review_gates_project ON public.review_gates(project_id);
CREATE INDEX idx_review_gates_status ON public.review_gates(status);

ALTER TABLE public.review_gates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own review_gates" ON public.review_gates
  FOR SELECT TO authenticated
  USING (user_owns_project(project_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own review_gates" ON public.review_gates
  FOR INSERT TO authenticated
  WITH CHECK (user_owns_project(project_id));

CREATE POLICY "Users can update own review_gates" ON public.review_gates
  FOR UPDATE TO authenticated
  USING (user_owns_project(project_id));

CREATE TRIGGER update_review_gates_updated_at
  BEFORE UPDATE ON public.review_gates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 7. Export Versions ──────────────────────────────────────
CREATE TABLE public.export_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  timeline_id uuid REFERENCES public.timelines(id) ON DELETE SET NULL,
  episode_id uuid REFERENCES public.episodes(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  format text NOT NULL DEFAULT 'mp4',
  resolution text NOT NULL DEFAULT '1080p',
  aspect_ratio text DEFAULT '16:9',
  look_preset text,
  status text NOT NULL DEFAULT 'pending',
  output_url text,
  file_size_bytes bigint,
  duration_ms bigint,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_export_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX idx_export_versions_project ON public.export_versions(project_id);

ALTER TABLE public.export_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own export_versions" ON public.export_versions
  FOR SELECT TO authenticated
  USING (user_owns_project(project_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own export_versions" ON public.export_versions
  FOR INSERT TO authenticated
  WITH CHECK (user_owns_project(project_id));

CREATE POLICY "Users can update own export_versions" ON public.export_versions
  FOR UPDATE TO authenticated
  USING (user_owns_project(project_id));

CREATE TRIGGER update_export_versions_updated_at
  BEFORE UPDATE ON public.export_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 8. Provider Payload Logs ────────────────────────────────
CREATE TABLE public.provider_payload_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  shot_id uuid,
  episode_shot_id uuid REFERENCES public.episode_shots(id) ON DELETE SET NULL,
  scene_id uuid REFERENCES public.scenes(id) ON DELETE SET NULL,
  provider text NOT NULL,
  model text NOT NULL,
  step text,
  payload_sent jsonb DEFAULT '{}'::jsonb,
  response_metadata jsonb DEFAULT '{}'::jsonb,
  latency_ms integer,
  status text DEFAULT 'sent',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_provider_logs_project ON public.provider_payload_logs(project_id);
CREATE INDEX idx_provider_logs_provider ON public.provider_payload_logs(provider);

ALTER TABLE public.provider_payload_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own provider_payload_logs" ON public.provider_payload_logs
  FOR SELECT TO authenticated
  USING (user_owns_project(project_id) OR has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert (edge functions)
CREATE POLICY "Service can insert provider_payload_logs" ON public.provider_payload_logs
  FOR INSERT TO service_role
  WITH CHECK (true);

-- ── 9. Update projects default ──────────────────────────────
ALTER TABLE public.projects ALTER COLUMN provider_default SET DEFAULT null;

-- ── 10. Enable realtime for key tables ──────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.timelines;
ALTER PUBLICATION supabase_realtime ADD TABLE public.timeline_clips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.review_gates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.export_versions;
