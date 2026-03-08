
-- P0-1: Atomic credit debit with balance check + idempotence
-- Replace existing debit_credits function with a proper atomic version
CREATE OR REPLACE FUNCTION public.debit_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_ref_id text DEFAULT NULL,
  p_ref_type text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance integer;
  v_existing_ledger_id uuid;
BEGIN
  -- Idempotence check: if same ref_id + ref_type already debited, skip
  IF p_ref_id IS NOT NULL AND p_ref_type IS NOT NULL THEN
    SELECT id INTO v_existing_ledger_id
    FROM public.credit_ledger
    WHERE ref_id = p_ref_id AND ref_type = p_ref_type AND delta < 0
    LIMIT 1;

    IF v_existing_ledger_id IS NOT NULL THEN
      RETURN true; -- Already debited, idempotent success
    END IF;
  END IF;

  -- Lock the wallet row for atomic update
  SELECT balance INTO v_current_balance
  FROM public.credit_wallets
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN false; -- No wallet
  END IF;

  IF v_current_balance < p_amount THEN
    RETURN false; -- Insufficient balance
  END IF;

  -- Debit wallet
  UPDATE public.credit_wallets
  SET balance = balance - p_amount, updated_at = now()
  WHERE id = p_user_id;

  -- Insert ledger entry
  INSERT INTO public.credit_ledger (user_id, delta, reason, ref_id, ref_type)
  VALUES (p_user_id, -p_amount, p_reason, p_ref_id, p_ref_type);

  RETURN true;
END;
$$;

-- P0-2: Ensure shots have CASCADE delete on project deletion
-- The FK already exists (shots_project_id_fkey), but let's ensure CASCADE
ALTER TABLE public.shots DROP CONSTRAINT IF EXISTS shots_project_id_fkey;
ALTER TABLE public.shots
  ADD CONSTRAINT shots_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id)
  ON DELETE CASCADE;

-- Same for plans, audio_analysis, renders, job_queue
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_project_id_fkey;
ALTER TABLE public.plans
  ADD CONSTRAINT plans_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id)
  ON DELETE CASCADE;

ALTER TABLE public.audio_analysis DROP CONSTRAINT IF EXISTS audio_analysis_project_id_fkey;
ALTER TABLE public.audio_analysis
  ADD CONSTRAINT audio_analysis_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id)
  ON DELETE CASCADE;

ALTER TABLE public.renders DROP CONSTRAINT IF EXISTS renders_project_id_fkey;
ALTER TABLE public.renders
  ADD CONSTRAINT renders_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id)
  ON DELETE CASCADE;

ALTER TABLE public.job_queue DROP CONSTRAINT IF EXISTS job_queue_project_id_fkey;
ALTER TABLE public.job_queue
  ADD CONSTRAINT job_queue_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id)
  ON DELETE CASCADE;

ALTER TABLE public.moderation_flags DROP CONSTRAINT IF EXISTS moderation_flags_project_id_fkey;
ALTER TABLE public.moderation_flags
  ADD CONSTRAINT moderation_flags_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id)
  ON DELETE CASCADE;

-- P0-3: Validation trigger to prevent renders with status=completed but null URLs
CREATE OR REPLACE FUNCTION public.validate_render_completion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.master_url_16_9 IS NULL THEN
    RAISE EXCEPTION 'Cannot mark render as completed without master_url_16_9';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_render_completion ON public.renders;
CREATE TRIGGER trg_validate_render_completion
  BEFORE INSERT OR UPDATE ON public.renders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_render_completion();
