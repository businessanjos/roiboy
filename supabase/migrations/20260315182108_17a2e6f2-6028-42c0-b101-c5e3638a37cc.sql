
-- Table to track commission per deal/contract with payment method awareness
CREATE TABLE public.commission_deal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.commission_plans(id) ON DELETE CASCADE,
  period_id UUID REFERENCES public.commission_periods(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.client_contracts(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client_name TEXT,
  deal_title TEXT,
  deal_value NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT, -- 'a_vista', 'cartao', 'cheque', 'pix_parcial'
  payment_option TEXT, -- raw payment_option from contract
  installments_count INTEGER DEFAULT 1,
  -- Commission calculation
  commission_percent NUMERIC NOT NULL DEFAULT 0,
  commission_total NUMERIC NOT NULL DEFAULT 0, -- full commission on total value
  -- PIX partial logic
  pix_installments_paid INTEGER DEFAULT 0, -- how many PIX installments paid (max 2)
  pix_amount_paid NUMERIC DEFAULT 0, -- amount paid via PIX
  commission_on_pix NUMERIC DEFAULT 0, -- commission released for PIX portion
  -- Remaining payment (card/check)
  remaining_amount NUMERIC DEFAULT 0, -- amount remaining after PIX
  remaining_paid BOOLEAN DEFAULT false, -- whether card/check was processed
  remaining_paid_at TIMESTAMPTZ,
  commission_on_remaining NUMERIC DEFAULT 0, -- commission released when remaining paid
  -- Total released
  commission_released NUMERIC NOT NULL DEFAULT 0, -- total commission actually released
  commission_pending NUMERIC NOT NULL DEFAULT 0, -- commission still pending
  -- Status
  payment_status TEXT NOT NULL DEFAULT 'awaiting_payment', -- 'awaiting_payment', 'partial_pix', 'fully_paid'
  commission_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'partial', 'released', 'paid'
  released_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan_id, deal_id, user_id)
);

-- RLS
ALTER TABLE public.commission_deal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view commission entries for their account"
  ON public.commission_deal_entries FOR SELECT TO authenticated
  USING (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can insert commission entries for their account"
  ON public.commission_deal_entries FOR INSERT TO authenticated
  WITH CHECK (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can update commission entries for their account"
  ON public.commission_deal_entries FOR UPDATE TO authenticated
  USING (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can delete commission entries for their account"
  ON public.commission_deal_entries FOR DELETE TO authenticated
  USING (account_id = public.get_current_user_account_id());

-- Index for fast lookups
CREATE INDEX idx_commission_deal_entries_account ON public.commission_deal_entries(account_id);
CREATE INDEX idx_commission_deal_entries_user ON public.commission_deal_entries(user_id);
CREATE INDEX idx_commission_deal_entries_period ON public.commission_deal_entries(period_id);
