
-- ============================================================
-- Phase 7: Production Robustness, QC, and Cost Governance
-- ============================================================

-- ── 1. Asset Normalization Results ──────────────────────────
CREATE TABLE public.asset_normalization_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.project_assets(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  width integer,
  height integer,
  fps real,
  codec text,
  container text,
  duration_ms bigint,
  audio_present boolean DEFAULT false,
  audio_sample_rate integer,
  audio_channels integer,
  audio_loudness_lufs real,
  aspect_ratio_detected text,
  poster_frame_url text,
  thumbnail_url text,
  normalized_at timestamptz DEFAULT now(),
  raw_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(asset_id)
);

CREATE INDEX idx_norm_results_project ON public.asset_normalization_results(project_id);

ALTER TABLE public.asset_normalization_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own normalization results" ON public.asset_normalization_results
  FOR SELECT TO authenticated
  USING (user_owns_project(project_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own normalization results" ON public.asset_normalization_results
  FOR INSERT TO authenticated
  WITH CHECK (user_owns_project(project_id));

CREATE POLICY "Service can manage normalization results" ON public.asset_normalization_results
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── 2. Scene Clip Candidates ────────────────────────────────
CREATE TABLE public.scene_clip_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scene_id uuid REFERENCES public.scenes(id) ON DELETE CASCADE,
  episode_shot_id uuid REFERENCES public.episode_shots(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES public.project_assets(id) ON DELETE SET NULL,
  rank integer NOT NULL DEFAULT 0,
  score_total real DEFAULT 0,
  score_duration_fit real DEFAULT 0,
  score_continuity real DEFAULT 0,
  score_visual_quality real DEFAULT 0,
  score_technical real DEFAULT 0,
  score_provider_confidence real DEFAULT 0,
  score_user_priority real DEFAULT 0,
  is_locked boolean DEFAULT false,
  is_approved boolean DEFAULT false,
  is_selected boolean DEFAULT false,
  ranking_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_clip_candidates_scene ON public.scene_clip_candidates(scene_id);
CREATE INDEX idx_clip_candidates_project ON public.scene_clip_candidates(project_id);

ALTER TABLE public.scene_clip_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own clip candidates" ON public.scene_clip_candidates
  FOR ALL TO authenticated
  USING (user_owns_project(project_id))
  WITH CHECK (user_owns_project(project_id));

CREATE POLICY "Service can manage clip candidates" ON public.scene_clip_candidates
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_clip_candidates_updated_at
  BEFORE UPDATE ON public.scene_clip_candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 3. Export Presets ───────────────────────────────────────
CREATE TABLE public.export_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  resolution text NOT NULL DEFAULT '1920x1080',
  target_bitrate_kbps integer DEFAULT 8000,
  fps integer DEFAULT 24,
  codec text DEFAULT 'h264',
  container text DEFAULT 'mp4',
  audio_codec text DEFAULT 'aac',
  audio_bitrate_kbps integer DEFAULT 192,
  audio_sample_rate integer DEFAULT 48000,
  subtitle_mode text DEFAULT 'none',
  title_safe_margin_pct real DEFAULT 10,
  crop_safe_margin_pct real DEFAULT 5,
  aspect_ratio text DEFAULT '16:9',
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.export_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view export_presets" ON public.export_presets
  FOR SELECT TO authenticated USING (true);

-- Seed default presets
INSERT INTO public.export_presets (name, display_name, resolution, target_bitrate_kbps, aspect_ratio, description) VALUES
  ('master_1080p', 'Master 1080p', '1920x1080', 8000, '16:9', 'Full HD master export'),
  ('preview_720p', 'Preview 720p', '1280x720', 4000, '16:9', 'Quick preview export'),
  ('vertical_social', 'Vertical Social', '1080x1920', 6000, '9:16', 'TikTok / Reels / Shorts'),
  ('square_social', 'Square Social', '1080x1080', 5000, '1:1', 'Instagram / Feed'),
  ('archive_mezzanine', 'Archive Mezzanine', '1920x1080', 15000, '16:9', 'High-quality archive');

-- ── 4. Project Budgets ─────────────────────────────────────
CREATE TABLE public.project_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  budget_limit_credits integer,
  estimated_total_cost integer DEFAULT 0,
  actual_total_cost integer DEFAULT 0,
  cost_mode text NOT NULL DEFAULT 'preview_first',
  per_scene_limit_credits integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_cost_mode CHECK (cost_mode IN ('preview_first', 'premium_first', 'strict_budget'))
);

ALTER TABLE public.project_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own project_budgets" ON public.project_budgets
  FOR ALL TO authenticated
  USING (user_owns_project(project_id))
  WITH CHECK (user_owns_project(project_id));

CREATE TRIGGER update_project_budgets_updated_at
  BEFORE UPDATE ON public.project_budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 5. Diagnostic Events ───────────────────────────────────
CREATE TABLE public.diagnostic_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'project',
  scope_id uuid,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  detail text,
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_scope CHECK (scope IN ('project', 'scene', 'job', 'export', 'clip', 'provider')),
  CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'error', 'critical'))
);

CREATE INDEX idx_diagnostic_events_project ON public.diagnostic_events(project_id);
CREATE INDEX idx_diagnostic_events_scope ON public.diagnostic_events(scope, scope_id);

ALTER TABLE public.diagnostic_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own diagnostic_events" ON public.diagnostic_events
  FOR SELECT TO authenticated
  USING (user_owns_project(project_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert diagnostic_events" ON public.diagnostic_events
  FOR INSERT TO service_role
  WITH CHECK (true);

-- ── 6. Column additions to existing tables ─────────────────

-- export_versions: render robustness
ALTER TABLE public.export_versions
  ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checksum text,
  ADD COLUMN IF NOT EXISTS failure_stage text,
  ADD COLUMN IF NOT EXISTS preset_name text;

-- project_assets: lifecycle state
ALTER TABLE public.project_assets
  ADD COLUMN IF NOT EXISTS lifecycle_state text DEFAULT 'temp';

-- job_queue: cost tracking
ALTER TABLE public.job_queue
  ADD COLUMN IF NOT EXISTS estimated_cost integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_cost integer DEFAULT 0;

-- timeline_tracks: audio controls
ALTER TABLE public.timeline_tracks
  ADD COLUMN IF NOT EXISTS gain real DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS solo boolean DEFAULT false;

-- ── 7. QC reports: add timeline_id and blocking flag ───────
ALTER TABLE public.qc_reports
  ADD COLUMN IF NOT EXISTS timeline_id uuid REFERENCES public.timelines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS has_blocking_issues boolean DEFAULT false;

-- ── 8. Enable realtime for new key tables ──────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.diagnostic_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scene_clip_candidates;
