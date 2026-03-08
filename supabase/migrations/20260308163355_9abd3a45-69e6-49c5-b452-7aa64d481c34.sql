DROP POLICY IF EXISTS "System updates wallets" ON public.credit_wallets;

CREATE POLICY "Only admins can update wallets"
ON public.credit_wallets
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));