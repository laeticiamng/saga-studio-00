-- Drop the uuid-overload of debit_credits and keep only the text version
DROP FUNCTION IF EXISTS public.debit_credits(uuid, integer, text, uuid, text);

-- Recreate the text-based version (idempotent, atomic)
CREATE OR REPLACE FUNCTION public.debit_credits(
  p_user_id uuid, p_amount integer, p_reason text, 
  p_ref_id text DEFAULT NULL, p_ref_type text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_balance integer;
  v_existing_ledger_id uuid;
BEGIN
  -- Idempotence check
  IF p_ref_id IS NOT NULL AND p_ref_type IS NOT NULL THEN
    SELECT id INTO v_existing_ledger_id
    FROM public.credit_ledger
    WHERE ref_id = p_ref_id AND ref_type = p_ref_type AND delta < 0
    LIMIT 1;
    IF v_existing_ledger_id IS NOT NULL THEN
      RETURN true;
    END IF;
  END IF;

  -- Lock wallet row
  SELECT balance INTO v_current_balance
  FROM public.credit_wallets WHERE id = p_user_id FOR UPDATE;

  IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
    RETURN false;
  END IF;

  UPDATE public.credit_wallets SET balance = balance - p_amount, updated_at = now() WHERE id = p_user_id;
  INSERT INTO public.credit_ledger (user_id, delta, reason, ref_id, ref_type)
  VALUES (p_user_id, -p_amount, p_reason, p_ref_id, p_ref_type);

  RETURN true;
END;
$$;

-- Also fix topup_credits to use text ref_id
DROP FUNCTION IF EXISTS public.topup_credits(uuid, integer, text, uuid, text);

CREATE OR REPLACE FUNCTION public.topup_credits(
  p_user_id uuid, p_amount integer, p_reason text,
  p_ref_id text DEFAULT NULL, p_ref_type text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_ref_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM credit_ledger WHERE ref_id = p_ref_id AND ref_type = p_ref_type) THEN
      RETURN false;
    END IF;
  END IF;

  INSERT INTO credit_wallets (id, balance) VALUES (p_user_id, p_amount)
  ON CONFLICT (id) DO UPDATE SET balance = credit_wallets.balance + p_amount, updated_at = now();

  INSERT INTO credit_ledger (user_id, delta, reason, ref_id, ref_type)
  VALUES (p_user_id, p_amount, p_reason, p_ref_id, p_ref_type);

  RETURN true;
END;
$$;