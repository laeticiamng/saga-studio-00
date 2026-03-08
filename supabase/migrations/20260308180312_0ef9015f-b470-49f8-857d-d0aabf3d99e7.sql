
-- Fix search_path on validate_render_completion function
CREATE OR REPLACE FUNCTION public.validate_render_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.master_url_16_9 IS NULL THEN
    RAISE EXCEPTION 'Cannot mark render as completed without master_url_16_9';
  END IF;
  RETURN NEW;
END;
$$;
