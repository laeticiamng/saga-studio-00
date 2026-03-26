-- Allow users to see job_queue entries for their own projects
CREATE POLICY "Users can view own job queue"
ON public.job_queue
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = job_queue.project_id
    AND projects.user_id = auth.uid()
  )
);