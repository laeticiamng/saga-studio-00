-- Idempotency: use composite unique on (ref_id, ref_type) to prevent duplicate webhook processing
-- First deduplicate existing data
DELETE FROM credit_ledger a USING credit_ledger b
WHERE a.id > b.id AND a.ref_id = b.ref_id AND a.ref_type = b.ref_type AND a.ref_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_ledger_idempotent ON public.credit_ledger (ref_id, ref_type) WHERE ref_id IS NOT NULL;

-- Atomic credit top-up function
CREATE OR REPLACE FUNCTION public.topup_credits(p_user_id uuid, p_amount integer, p_reason text, p_ref_id uuid DEFAULT NULL, p_ref_type text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check idempotency
  IF p_ref_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM credit_ledger WHERE ref_id = p_ref_id AND ref_type = p_ref_type) THEN
      RETURN false;
    END IF;
  END IF;

  -- Atomic credit addition
  INSERT INTO credit_wallets (id, balance) VALUES (p_user_id, p_amount)
  ON CONFLICT (id) DO UPDATE SET balance = credit_wallets.balance + p_amount, updated_at = now();

  -- Record ledger entry
  INSERT INTO credit_ledger (user_id, delta, reason, ref_id, ref_type)
  VALUES (p_user_id, p_amount, p_reason, p_ref_id, p_ref_type);

  RETURN true;
END;
$$;