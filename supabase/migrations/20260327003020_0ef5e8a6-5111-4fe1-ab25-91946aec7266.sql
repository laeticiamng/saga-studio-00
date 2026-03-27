
-- Enable Realtime for workflow_steps and approval_steps
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.workflow_steps;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.approval_steps;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS: Allow INSERT on webhook_endpoints for authenticated users
DO $$ BEGIN
  CREATE POLICY "Users can insert own webhook_endpoints" ON public.webhook_endpoints
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own webhook_endpoints" ON public.webhook_endpoints
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own webhook_endpoints" ON public.webhook_endpoints
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
