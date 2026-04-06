
CREATE TABLE public.renewal_outcomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.client_contracts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL DEFAULT 'pending' CHECK (outcome IN ('renewed', 'lost', 'pending')),
  loss_reason TEXT,
  loss_notes TEXT,
  renewal_value NUMERIC DEFAULT 0,
  new_contract_id UUID REFERENCES public.client_contracts(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contract_id)
);

ALTER TABLE public.renewal_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view renewal outcomes in their account"
  ON public.renewal_outcomes FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can create renewal outcomes in their account"
  ON public.renewal_outcomes FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update renewal outcomes in their account"
  ON public.renewal_outcomes FOR UPDATE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Admins can delete renewal outcomes"
  ON public.renewal_outcomes FOR DELETE TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.users 
      WHERE auth_user_id = auth.uid() AND (role = 'admin' OR is_also_admin = true)
    )
  );

CREATE INDEX idx_renewal_outcomes_account ON public.renewal_outcomes(account_id);
CREATE INDEX idx_renewal_outcomes_contract ON public.renewal_outcomes(contract_id);
CREATE INDEX idx_renewal_outcomes_client ON public.renewal_outcomes(client_id);
CREATE INDEX idx_renewal_outcomes_outcome ON public.renewal_outcomes(outcome);

CREATE TRIGGER update_renewal_outcomes_updated_at
  BEFORE UPDATE ON public.renewal_outcomes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
