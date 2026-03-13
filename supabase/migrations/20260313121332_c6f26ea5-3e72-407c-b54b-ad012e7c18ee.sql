-- Drop the notify_render_completed trigger that depends on pg_net
DROP TRIGGER IF EXISTS on_render_completed ON public.renders;

-- Recreate notify_render_completed without pg_net dependency
CREATE OR REPLACE FUNCTION public.notify_render_completed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only fire when status transitions to 'completed'
  -- Webhook dispatch will be handled by the edge function directly
  RETURN NEW;
END;
$function$;