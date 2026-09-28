CREATE TABLE public.spiff_spin_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  spin_id uuid NOT NULL REFERENCES public.spiff_spins(id) ON DELETE CASCADE,
  spiff_id uuid NOT NULL,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  captured_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (spiff_id, deal_id)
);
CREATE INDEX idx_spiff_spin_deals_spin ON public.spiff_spin_deals(spin_id);
GRANT SELECT, INSERT, DELETE ON public.spiff_spin_deals TO authenticated;
GRANT ALL ON public.spiff_spin_deals TO service_role;
ALTER TABLE public.spiff_spin_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View spin deals in account" ON public.spiff_spin_deals FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Create spin deals in account" ON public.spiff_spin_deals FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()) AND public.user_has_sector_access(auth.uid(), 'vendas'));
CREATE POLICY "Delete spin deals in account" ON public.spiff_spin_deals FOR DELETE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()) AND public.user_has_sector_access(auth.uid(), 'vendas'));