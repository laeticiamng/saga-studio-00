-- Ticket 1: Fix ref_id type mismatch (uuid → text) for idempotent debit with string ref_ids
ALTER TABLE public.credit_ledger ALTER COLUMN ref_id TYPE text USING ref_id::text;

-- Ticket 3: Ensure validate_render_completion trigger exists
CREATE OR REPLACE FUNCTION public.validate_render_completion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.master_url_16_9 IS NULL THEN
    RAISE EXCEPTION 'Cannot mark render as completed without master_url_16_9';
  END IF;
  -- Block completed status with placeholder URLs
  IF NEW.status = 'completed' AND (
    NEW.master_url_16_9 LIKE '%placeholder%' OR 
    NEW.master_url_16_9 = '' OR
    NEW.master_url_16_9 LIKE 'data:%'
  ) THEN
    RAISE EXCEPTION 'Cannot mark render as completed with placeholder URL';
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger if not exists
DROP TRIGGER IF EXISTS trg_validate_render_completion ON public.renders;
CREATE TRIGGER trg_validate_render_completion
  BEFORE INSERT OR UPDATE ON public.renders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_render_completion();

-- Ticket 2: Ensure shots.project_id is NOT NULL (should already be, but enforce)
ALTER TABLE public.shots ALTER COLUMN project_id SET NOT NULL;