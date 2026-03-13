CREATE OR REPLACE FUNCTION public.validate_render_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'completed' AND NEW.master_url_16_9 IS NULL THEN
    RAISE EXCEPTION 'Cannot mark render as completed without master_url_16_9';
  END IF;
  IF NEW.status = 'completed' AND (
    NEW.master_url_16_9 LIKE '%placeholder%' OR 
    NEW.master_url_16_9 = '' OR
    NEW.master_url_16_9 LIKE 'data:%'
  ) AND NEW.master_url_16_9 NOT LIKE '%manifest.json%' THEN
    RAISE EXCEPTION 'Cannot mark render as completed with placeholder URL';
  END IF;
  RETURN NEW;
END;
$function$;