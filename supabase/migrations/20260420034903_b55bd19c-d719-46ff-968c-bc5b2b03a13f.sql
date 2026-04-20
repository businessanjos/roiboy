-- Tabela de giros consumidos da roleta
CREATE TABLE public.spiff_spins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  spiff_id UUID NOT NULL REFERENCES public.sales_spiffs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  prize_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  spun_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_spiff_spins_spiff ON public.spiff_spins(spiff_id);
CREATE INDEX idx_spiff_spins_user ON public.spiff_spins(user_id);
CREATE INDEX idx_spiff_spins_account ON public.spiff_spins(account_id);

ALTER TABLE public.spiff_spins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view spiff spins from their account"
ON public.spiff_spins
FOR SELECT
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can create spiff spins in their account"
ON public.spiff_spins
FOR INSERT
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete spiff spins from their account"
ON public.spiff_spins
FOR DELETE
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.spiff_spins;
ALTER TABLE public.spiff_spins REPLICA IDENTITY FULL;