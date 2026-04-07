
-- =============================================
-- 1. NEW TABLES
-- =============================================

-- Governance Policies (central policy registry)
CREATE TABLE public.governance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key text NOT NULL UNIQUE,
  domain text NOT NULL DEFAULT 'project',
  description text,
  rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  enforcement_mode text NOT NULL DEFAULT 'block',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.governance_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view governance_policies" ON public.governance_policies FOR SELECT TO authenticated USING (true);

-- Governance Transitions (allowed state transitions)
CREATE TABLE public.governance_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL DEFAULT 'project',
  from_state text NOT NULL,
  to_state text NOT NULL,
  required_approvals jsonb DEFAULT '[]'::jsonb,
  guard_conditions jsonb DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(domain, from_state, to_state)
);
ALTER TABLE public.governance_transitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view governance_transitions" ON public.governance_transitions FOR SELECT TO authenticated USING (true);

-- Governance Violations (policy violation log)
CREATE TABLE public.governance_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  actor_type text NOT NULL DEFAULT 'system',
  actor_id text,
  reason text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.governance_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own violations" ON public.governance_violations FOR SELECT TO authenticated USING (user_owns_project(project_id) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service can insert violations" ON public.governance_violations FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Authenticated can insert violations" ON public.governance_violations FOR INSERT TO authenticated WITH CHECK (user_owns_project(project_id));

-- Incidents (structured incident tracking)
CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'project',
  scope_id uuid,
  severity text NOT NULL DEFAULT 'warning',
  root_cause_class text,
  status text NOT NULL DEFAULT 'open',
  title text NOT NULL,
  detail text,
  resolution_notes text,
  auto_retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own incidents" ON public.incidents FOR SELECT TO authenticated USING (user_owns_project(project_id) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service can manage incidents" ON public.incidents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can insert own incidents" ON public.incidents FOR INSERT TO authenticated WITH CHECK (user_owns_project(project_id));
CREATE POLICY "Users can update own incidents" ON public.incidents FOR UPDATE TO authenticated USING (user_owns_project(project_id));

CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 2. COLUMN ADDITIONS
-- =============================================

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS governance_state text NOT NULL DEFAULT 'draft';

ALTER TABLE public.review_gates ADD COLUMN IF NOT EXISTS version_ref text;
ALTER TABLE public.review_gates ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE public.review_gates ADD COLUMN IF NOT EXISTS gate_owner text DEFAULT 'user';
ALTER TABLE public.review_gates ADD COLUMN IF NOT EXISTS stale boolean NOT NULL DEFAULT false;
ALTER TABLE public.review_gates ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.review_gates(id);

ALTER TABLE public.export_versions ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE public.export_versions ADD COLUMN IF NOT EXISTS timeline_version_ref text;

ALTER TABLE public.timelines ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.timelines ADD COLUMN IF NOT EXISTS locked_by uuid;

ALTER TABLE public.project_assets ADD COLUMN IF NOT EXISTS created_by uuid;

-- =============================================
-- 3. SEED FEATURE FLAGS
-- =============================================

INSERT INTO public.feature_flags (key, description, enabled) VALUES
  ('unified_wizard', 'Unified project creation wizard', true),
  ('timeline_studio', 'Timeline studio interface', true),
  ('finishing_presets', 'Look/finishing preset system', true),
  ('export_engine', 'Versioned export engine', true),
  ('hybrid_video', 'Hybrid video upload flow', false),
  ('candidate_ranking', 'Shot candidate ranking system', true),
  ('qc_blocking_mode', 'QC blocks export on critical issues', true)
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- 4. SEED GOVERNANCE POLICIES
-- =============================================

INSERT INTO public.governance_policies (policy_key, domain, description, rule, enforcement_mode) VALUES
  ('no_gen_before_identity', 'scene', 'No scene generation before identity/character approval', '{"requires_gate":"character_pack","status":"approved"}', 'block'),
  ('no_export_without_qc', 'export', 'No final export if blocking QC errors exist', '{"requires":"qc_pass","blocking_issues":false}', 'block'),
  ('no_premium_over_budget', 'cost', 'No premium provider usage beyond budget ceiling', '{"check":"budget_remaining","threshold":0}', 'block'),
  ('no_delete_approved_assets', 'storage', 'No destructive cleanup on approved/final assets', '{"protected_states":["approved_source","final_master","export_source"]}', 'block'),
  ('no_replace_locked_clips', 'timeline', 'No timeline replacement of locked clips without unlock', '{"requires":"explicit_unlock"}', 'block'),
  ('no_archive_running_exports', 'project', 'No project archival if export jobs still running', '{"check":"no_active_exports"}', 'block'),
  ('no_silent_fallback', 'provider', 'No provider fallback without diagnostic logging', '{"requires":"diagnostic_event"}', 'warn'),
  ('no_export_without_version', 'export', 'No final export without version link', '{"requires":"timeline_version_ref"}', 'block'),
  ('no_hidden_transitions', 'project', 'All state transitions must be logged', '{"requires":"audit_log_entry"}', 'block'),
  ('no_approval_after_upstream_change', 'review', 'Stale approvals must be invalidated on upstream changes', '{"auto_stale":true}', 'warn')
ON CONFLICT (policy_key) DO NOTHING;

-- =============================================
-- 5. SEED GOVERNANCE TRANSITIONS
-- =============================================

INSERT INTO public.governance_transitions (domain, from_state, to_state, required_approvals, guard_conditions) VALUES
  ('project', 'draft', 'setup_in_progress', '[]', '[]'),
  ('project', 'setup_in_progress', 'awaiting_identity_review', '[]', '[{"check":"has_character_pack"}]'),
  ('project', 'awaiting_identity_review', 'awaiting_world_review', '[{"gate":"character_pack"}]', '[]'),
  ('project', 'awaiting_world_review', 'planning', '[{"gate":"world_pack"}]', '[]'),
  ('project', 'planning', 'awaiting_scene_review', '[]', '[{"check":"has_scenes"}]'),
  ('project', 'awaiting_scene_review', 'generating', '[{"gate":"scene_plan"}]', '[]'),
  ('project', 'generating', 'awaiting_clip_review', '[]', '[{"check":"all_shots_complete"}]'),
  ('project', 'awaiting_clip_review', 'assembling', '[{"gate":"scene_clips"}]', '[]'),
  ('project', 'assembling', 'awaiting_rough_cut_review', '[]', '[{"check":"has_rough_cut"}]'),
  ('project', 'awaiting_rough_cut_review', 'fine_cut_in_progress', '[{"gate":"rough_cut"}]', '[]'),
  ('project', 'fine_cut_in_progress', 'awaiting_fine_cut_review', '[]', '[]'),
  ('project', 'awaiting_fine_cut_review', 'qc_pending', '[{"gate":"fine_cut"}]', '[]'),
  ('project', 'qc_pending', 'export_ready', '[]', '[{"check":"qc_pass"}]'),
  ('project', 'export_ready', 'exporting', '[]', '[]'),
  ('project', 'exporting', 'delivered', '[]', '[{"check":"export_complete"}]'),
  ('project', 'delivered', 'archived', '[]', '[{"check":"no_active_exports"}]'),
  ('project', 'generating', 'failed', '[]', '[]'),
  ('project', 'exporting', 'failed', '[]', '[]')
ON CONFLICT (domain, from_state, to_state) DO NOTHING;
