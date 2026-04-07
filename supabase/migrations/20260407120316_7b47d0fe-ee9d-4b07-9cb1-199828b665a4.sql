
-- =============================================
-- 1. ABERRATION CATEGORIES (taxonomy)
-- =============================================
CREATE TABLE public.aberration_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  subcategory text NOT NULL,
  description text,
  severity_default text NOT NULL DEFAULT 'major',
  repair_action_default text NOT NULL DEFAULT 'regenerate',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(category, subcategory)
);
ALTER TABLE public.aberration_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view aberration_categories" ON public.aberration_categories FOR SELECT TO authenticated USING (true);

-- =============================================
-- 2. ASSET VALIDATIONS
-- =============================================
CREATE TABLE public.asset_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.project_assets(id) ON DELETE SET NULL,
  episode_shot_id uuid REFERENCES public.episode_shots(id) ON DELETE SET NULL,
  scene_id uuid,
  asset_type text NOT NULL DEFAULT 'image',
  validation_status text NOT NULL DEFAULT 'pending',
  scores jsonb NOT NULL DEFAULT '{"anatomy":null,"temporal":null,"semantic":null,"continuity":null,"av":null,"framing":null,"final":null}'::jsonb,
  blocking boolean NOT NULL DEFAULT false,
  validator_type text NOT NULL DEFAULT 'ai_judge',
  explanation text,
  pass_results jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.asset_validations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own asset_validations" ON public.asset_validations FOR SELECT TO authenticated USING (user_owns_project(project_id) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert own asset_validations" ON public.asset_validations FOR INSERT TO authenticated WITH CHECK (user_owns_project(project_id));
CREATE POLICY "Users can update own asset_validations" ON public.asset_validations FOR UPDATE TO authenticated USING (user_owns_project(project_id));
CREATE POLICY "Service can manage asset_validations" ON public.asset_validations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER update_asset_validations_updated_at BEFORE UPDATE ON public.asset_validations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 3. ANOMALY EVENTS
-- =============================================
CREATE TABLE public.anomaly_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_id uuid NOT NULL REFERENCES public.asset_validations(id) ON DELETE CASCADE,
  category text NOT NULL,
  subcategory text,
  severity text NOT NULL DEFAULT 'major',
  confidence real DEFAULT 0.5,
  explanation text,
  suggested_fix text,
  auto_fix_attempted boolean NOT NULL DEFAULT false,
  auto_fix_result text,
  blocking boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.anomaly_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own anomaly_events" ON public.anomaly_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.asset_validations av WHERE av.id = anomaly_events.validation_id AND user_owns_project(av.project_id)) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service can manage anomaly_events" ON public.anomaly_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can insert anomaly_events" ON public.anomaly_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.asset_validations av WHERE av.id = anomaly_events.validation_id AND user_owns_project(av.project_id)));

-- =============================================
-- 4. REPAIR ATTEMPTS
-- =============================================
CREATE TABLE public.repair_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anomaly_event_id uuid NOT NULL REFERENCES public.anomaly_events(id) ON DELETE CASCADE,
  repair_mode text NOT NULL DEFAULT 'regenerate',
  provider_used text,
  result_asset_id uuid REFERENCES public.project_assets(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt_number integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.repair_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own repair_attempts" ON public.repair_attempts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.anomaly_events ae JOIN public.asset_validations av ON av.id = ae.validation_id WHERE ae.id = repair_attempts.anomaly_event_id AND user_owns_project(av.project_id)) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service can manage repair_attempts" ON public.repair_attempts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================
-- 5. REPAIR POLICIES
-- =============================================
CREATE TABLE public.repair_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL UNIQUE,
  default_action text NOT NULL DEFAULT 'regenerate',
  max_retries integer NOT NULL DEFAULT 3,
  escalation_action text NOT NULL DEFAULT 'manual_review',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.repair_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view repair_policies" ON public.repair_policies FOR SELECT TO authenticated USING (true);

-- =============================================
-- 6. PROJECT VALIDATION REPORTS
-- =============================================
CREATE TABLE public.project_validation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  timeline_version text,
  total_anomalies integer NOT NULL DEFAULT 0,
  blocking_count integer NOT NULL DEFAULT 0,
  premium_readiness_score real DEFAULT 0,
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_validation_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own project_validation_reports" ON public.project_validation_reports FOR SELECT TO authenticated USING (user_owns_project(project_id) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service can manage project_validation_reports" ON public.project_validation_reports FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================
-- 7. SEED ABERRATION CATEGORIES
-- =============================================
INSERT INTO public.aberration_categories (category, subcategory, description, severity_default, repair_action_default) VALUES
  ('anatomy', 'extra_limbs', 'Extra arms, legs, or fingers', 'blocking', 'regenerate'),
  ('anatomy', 'missing_limbs', 'Missing body parts', 'major', 'regenerate'),
  ('anatomy', 'melted_face', 'Distorted or melted facial features', 'blocking', 'regenerate'),
  ('anatomy', 'broken_eyes', 'Asymmetric or fused eyes', 'major', 'regenerate'),
  ('anatomy', 'impossible_articulation', 'Physically impossible body pose', 'major', 'regenerate'),
  ('object', 'object_morphing', 'Object changes shape unexpectedly', 'major', 'regenerate'),
  ('object', 'object_disappearance', 'Object vanishes mid-scene', 'major', 'regenerate'),
  ('object', 'object_substitution', 'Object replaced by different object', 'moderate', 'regenerate'),
  ('object', 'prop_inconsistency', 'Props differ from approved refs', 'moderate', 'regenerate'),
  ('temporal', 'flicker', 'Frame-to-frame brightness/content flicker', 'major', 'repair_rerender'),
  ('temporal', 'identity_drift', 'Character identity changes between frames', 'blocking', 'regenerate_locked_refs'),
  ('temporal', 'continuity_break', 'Action/position jumps between frames', 'major', 'regenerate'),
  ('temporal', 'jerky_motion', 'Unnatural stuttering motion', 'moderate', 'repair_rerender'),
  ('temporal', 'scene_reset', 'Scene resets within same shot', 'blocking', 'regenerate'),
  ('physics', 'gravity_inconsistency', 'Objects defy gravity implausibly', 'moderate', 'regenerate'),
  ('physics', 'object_permanence_failure', 'Objects appear/disappear without cause', 'major', 'regenerate'),
  ('physics', 'impossible_trajectory', 'Impossible motion path', 'moderate', 'regenerate'),
  ('semantic', 'wrong_action', 'Output does not match requested action', 'blocking', 'regenerate'),
  ('semantic', 'wrong_setting', 'Scene location does not match script', 'major', 'regenerate'),
  ('semantic', 'wrong_character_count', 'Wrong number of characters in scene', 'major', 'regenerate'),
  ('semantic', 'wrong_emotion', 'Character emotion mismatches script', 'moderate', 'regenerate'),
  ('semantic', 'wrong_mood', 'Scene mood/ambiance mismatches intent', 'moderate', 'regenerate'),
  ('identity', 'face_drift', 'Character face differs from approved ref', 'blocking', 'regenerate_locked_refs'),
  ('identity', 'costume_drift', 'Clothing differs from approved ref', 'major', 'regenerate_locked_refs'),
  ('identity', 'location_drift', 'Background/location drifts from approved ref', 'moderate', 'regenerate'),
  ('framing', 'unintended_crop', 'Subject cut off by framing', 'major', 'reframe'),
  ('framing', 'wrong_aspect_ratio', 'Output aspect ratio wrong', 'blocking', 'reframe'),
  ('framing', 'subject_hidden', 'Main subject obscured or hidden', 'major', 'regenerate'),
  ('text_graphic', 'broken_text', 'Embedded text is garbled or unreadable', 'moderate', 'regenerate'),
  ('text_graphic', 'wrong_text_content', 'Text content is incorrect', 'major', 'regenerate'),
  ('audio', 'lip_sync_mismatch', 'Audio does not match lip movement', 'major', 'repair_rerender'),
  ('audio', 'wrong_ambience', 'Ambient sound mismatches scene', 'moderate', 'regenerate'),
  ('audio', 'audio_artifact', 'Unexpected audio glitch or pop', 'moderate', 'repair_rerender')
ON CONFLICT (category, subcategory) DO NOTHING;

-- =============================================
-- 8. SEED REPAIR POLICIES
-- =============================================
INSERT INTO public.repair_policies (category, default_action, max_retries, escalation_action) VALUES
  ('anatomy', 'regenerate', 3, 'manual_review'),
  ('object', 'regenerate', 3, 'manual_review'),
  ('temporal', 'repair_rerender', 2, 'regenerate'),
  ('physics', 'regenerate', 2, 'manual_review'),
  ('semantic', 'regenerate', 3, 'split_and_simplify'),
  ('identity', 'regenerate_locked_refs', 3, 'manual_review'),
  ('framing', 'reframe', 2, 'regenerate'),
  ('text_graphic', 'regenerate', 2, 'switch_provider'),
  ('audio', 'repair_rerender', 2, 'regenerate')
ON CONFLICT (category) DO NOTHING;
