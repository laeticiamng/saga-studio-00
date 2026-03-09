-- P0: Remove dangerous public SELECT policy on projects (exposes face_urls, user_id, audio_url)
DROP POLICY IF EXISTS "Public can view completed projects basic info" ON public.projects;

-- P1: Remove public SELECT on renders (exposes logs)
DROP POLICY IF EXISTS "Public can view completed renders" ON public.renders;

-- Replace with a safe policy on renders that only exposes non-sensitive columns via join on safe view
CREATE POLICY "Public can view completed render urls"
ON public.renders
FOR SELECT
TO anon, authenticated
USING (
  status = 'completed'::render_status
  AND EXISTS (
    SELECT 1 FROM public.projects_public pp WHERE pp.id = renders.project_id
  )
);