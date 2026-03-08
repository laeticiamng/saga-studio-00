
-- Webhook endpoints table: users register URLs to receive render completion notifications
CREATE TABLE public.webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  url text NOT NULL,
  secret text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  events text[] NOT NULL DEFAULT '{render.completed}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own webhooks" ON public.webhook_endpoints
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Webhook delivery log
CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status_code integer,
  response_body text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deliveries" ON public.webhook_deliveries
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.webhook_endpoints we
    WHERE we.id = webhook_deliveries.endpoint_id AND we.user_id = auth.uid()
  ));

-- Function to dispatch webhooks on render completion via pg_net
CREATE OR REPLACE FUNCTION public.notify_render_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project record;
  v_endpoint record;
  v_payload jsonb;
BEGIN
  -- Only fire when status transitions to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT id, user_id, title, type, style_preset INTO v_project
    FROM public.projects WHERE id = NEW.project_id;

    IF v_project IS NULL THEN RETURN NEW; END IF;

    v_payload := jsonb_build_object(
      'event', 'render.completed',
      'timestamp', now(),
      'project_id', NEW.project_id,
      'render_id', NEW.id,
      'project_title', v_project.title,
      'project_type', v_project.type,
      'master_url_16_9', NEW.master_url_16_9,
      'master_url_9_16', NEW.master_url_9_16,
      'teaser_url', NEW.teaser_url
    );

    -- Call the edge function to dispatch webhooks asynchronously
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/dispatch-webhooks',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'user_id', v_project.user_id,
        'payload', v_payload
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Attach the trigger to renders table
CREATE TRIGGER on_render_completed
  AFTER UPDATE ON public.renders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_render_completed();
