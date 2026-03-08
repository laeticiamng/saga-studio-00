-- 1. Lock down credit_ledger: block all direct writes from client
CREATE POLICY "No direct insert on credit_ledger" ON public.credit_ledger
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "No direct update on credit_ledger" ON public.credit_ledger
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "No direct delete on credit_ledger" ON public.credit_ledger
  FOR DELETE TO authenticated
  USING (false);

-- 2. Lock down credit_wallets: block INSERT/DELETE from clients
CREATE POLICY "No direct insert on credit_wallets" ON public.credit_wallets
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "No direct delete on credit_wallets" ON public.credit_wallets
  FOR DELETE TO authenticated
  USING (false);