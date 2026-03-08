-- Atomic credit debit function: returns true if debit succeeded, false if insufficient
CREATE OR REPLACE FUNCTION public.debit_credits(p_user_id uuid, p_amount integer, p_reason text, p_ref_id uuid DEFAULT NULL, p_ref_type text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rows_affected integer;
BEGIN
  -- Atomic debit: only succeeds if balance >= amount
  UPDATE credit_wallets
  SET balance = balance - p_amount, updated_at = now()
  WHERE id = p_user_id AND balance >= p_amount;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected = 0 THEN
    RETURN false;
  END IF;

  -- Record ledger entry
  INSERT INTO credit_ledger (user_id, delta, reason, ref_id, ref_type)
  VALUES (p_user_id, -p_amount, p_reason, p_ref_id, p_ref_type);

  RETURN true;
END;
$$;

-- Also clean up the orphan shots on project d17635dd
UPDATE shots SET status = 'failed', error_message = 'Orphaned: project completed without generating this shot'
WHERE project_id = 'd17635dd-1318-4637-9dc4-66ef4df76e36' AND status = 'pending';