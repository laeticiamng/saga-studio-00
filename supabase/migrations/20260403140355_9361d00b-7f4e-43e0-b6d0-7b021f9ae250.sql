
-- =====================================================
-- 5. Attach missing updated_at triggers (safe idempotent)
-- =====================================================

DROP TRIGGER IF EXISTS update_renders_updated_at ON public.renders;
CREATE TRIGGER update_renders_updated_at
  BEFORE UPDATE ON public.renders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_scenes_updated_at ON public.scenes;
CREATE TRIGGER update_scenes_updated_at
  BEFORE UPDATE ON public.scenes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_scripts_updated_at ON public.scripts;
CREATE TRIGGER update_scripts_updated_at
  BEFORE UPDATE ON public.scripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_episodes_updated_at ON public.episodes;
CREATE TRIGGER update_episodes_updated_at
  BEFORE UPDATE ON public.episodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_seasons_updated_at ON public.seasons;
CREATE TRIGGER update_seasons_updated_at
  BEFORE UPDATE ON public.seasons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_series_updated_at ON public.series;
CREATE TRIGGER update_series_updated_at
  BEFORE UPDATE ON public.series
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_character_profiles_updated_at ON public.character_profiles;
CREATE TRIGGER update_character_profiles_updated_at
  BEFORE UPDATE ON public.character_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_bibles_updated_at ON public.bibles;
CREATE TRIGGER update_bibles_updated_at
  BEFORE UPDATE ON public.bibles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_continuity_memory_nodes_updated_at ON public.continuity_memory_nodes;
CREATE TRIGGER update_continuity_memory_nodes_updated_at
  BEFORE UPDATE ON public.continuity_memory_nodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_delivery_manifests_updated_at ON public.delivery_manifests;
CREATE TRIGGER update_delivery_manifests_updated_at
  BEFORE UPDATE ON public.delivery_manifests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_export_jobs_updated_at ON public.export_jobs;
CREATE TRIGGER update_export_jobs_updated_at
  BEFORE UPDATE ON public.export_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 6. Attach render validation trigger
-- =====================================================
DROP TRIGGER IF EXISTS validate_render_before_complete ON public.renders;
CREATE TRIGGER validate_render_before_complete
  BEFORE UPDATE ON public.renders
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION public.validate_render_completion();

-- =====================================================
-- 7. Attach render notification trigger
-- =====================================================
DROP TRIGGER IF EXISTS notify_render_done ON public.renders;
CREATE TRIGGER notify_render_done
  AFTER UPDATE ON public.renders
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION public.notify_render_completed();

-- =====================================================
-- 8. Drop legacy duplicate workflow policies
-- =====================================================
DROP POLICY IF EXISTS "Users can view own approvals" ON public.workflow_approvals;
DROP POLICY IF EXISTS "Users can view own confidence scores" ON public.workflow_confidence_scores;
DROP POLICY IF EXISTS "Users can view own workflow runs" ON public.workflow_runs;
DROP POLICY IF EXISTS "Users can view own step runs" ON public.workflow_step_runs;
DROP POLICY IF EXISTS "Users can view own workflow steps" ON public.workflow_steps;
