
ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS card_fee_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS card_fee_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS card_acquirer text,
  ADD COLUMN IF NOT EXISTS card_brand text,
  ADD COLUMN IF NOT EXISTS card_nsu text,
  ADD COLUMN IF NOT EXISTS card_authorization_code text,
  ADD COLUMN IF NOT EXISTS net_amount numeric;

CREATE INDEX IF NOT EXISTS idx_installments_card_nsu ON public.installments(card_nsu) WHERE card_nsu IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.financial_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL DEFAULT public.get_user_account_id(),
  source text NOT NULL CHECK (source IN ('cielo','cheques','bank_statement','manual')),
  filename text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','preview','applied','failed','cancelled')),
  total_rows integer DEFAULT 0,
  matched_rows integer DEFAULT 0,
  unmatched_rows integer DEFAULT 0,
  duplicate_rows integer DEFAULT 0,
  settled_rows integer DEFAULT 0,
  total_amount numeric DEFAULT 0,
  total_fee_amount numeric DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financial_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL DEFAULT public.get_user_account_id(),
  batch_id uuid NOT NULL REFERENCES public.financial_import_batches(id) ON DELETE CASCADE,
  raw jsonb NOT NULL,
  parsed_date date,
  parsed_amount numeric,
  parsed_fee_amount numeric DEFAULT 0,
  parsed_net_amount numeric,
  parsed_brand text,
  parsed_nsu text,
  parsed_auth_code text,
  parsed_doc text,
  parsed_payer_name text,
  installment_id uuid REFERENCES public.installments(id) ON DELETE SET NULL,
  match_score numeric,
  status text NOT NULL DEFAULT 'unmatched' CHECK (status IN ('matched','unmatched','duplicate','settled','ignored','error')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_rows_batch ON public.financial_import_rows(batch_id);
CREATE INDEX IF NOT EXISTS idx_import_rows_installment ON public.financial_import_rows(installment_id);
CREATE INDEX IF NOT EXISTS idx_import_rows_status ON public.financial_import_rows(status);

ALTER TABLE public.financial_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_import_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view import batches" ON public.financial_import_batches FOR SELECT
  USING (account_id = public.get_user_account_id());
CREATE POLICY "insert import batches" ON public.financial_import_batches FOR INSERT
  WITH CHECK (account_id = public.get_user_account_id());
CREATE POLICY "update import batches" ON public.financial_import_batches FOR UPDATE
  USING (account_id = public.get_user_account_id());
CREATE POLICY "delete import batches" ON public.financial_import_batches FOR DELETE
  USING (account_id = public.get_user_account_id());

CREATE POLICY "view import rows" ON public.financial_import_rows FOR SELECT
  USING (account_id = public.get_user_account_id());
CREATE POLICY "insert import rows" ON public.financial_import_rows FOR INSERT
  WITH CHECK (account_id = public.get_user_account_id());
CREATE POLICY "update import rows" ON public.financial_import_rows FOR UPDATE
  USING (account_id = public.get_user_account_id());
CREATE POLICY "delete import rows" ON public.financial_import_rows FOR DELETE
  USING (account_id = public.get_user_account_id());

CREATE TABLE IF NOT EXISTS public.bank_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid,
  source text NOT NULL,
  event_type text,
  external_id text,
  payload jsonb NOT NULL,
  amount numeric,
  occurred_at timestamptz,
  installment_id uuid REFERENCES public.installments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','matched','settled','unmatched','duplicate','error','ignored')),
  error_message text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_webhook_events_external ON public.bank_webhook_events(source, external_id);
CREATE INDEX IF NOT EXISTS idx_bank_webhook_events_installment ON public.bank_webhook_events(installment_id);

ALTER TABLE public.bank_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view bank webhook events" ON public.bank_webhook_events FOR SELECT
  USING (account_id = public.get_user_account_id());

CREATE OR REPLACE FUNCTION public.settle_installment_from_import(
  p_row_id uuid,
  p_payment_status text DEFAULT 'cartao_capturado'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.financial_import_rows%ROWTYPE;
  v_inst public.installments%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.financial_import_rows WHERE id = p_row_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Import row not found';
  END IF;
  IF v_row.installment_id IS NULL THEN
    RAISE EXCEPTION 'Row has no matched installment';
  END IF;

  SELECT * INTO v_inst FROM public.installments WHERE id = v_row.installment_id FOR UPDATE;
  IF v_inst.status = 'paid' THEN
    UPDATE public.financial_import_rows SET status = 'duplicate' WHERE id = p_row_id;
    RETURN v_inst.id;
  END IF;

  UPDATE public.installments SET
    status = 'paid',
    payment_status = p_payment_status,
    paid_amount = COALESCE(v_row.parsed_amount, amount),
    paid_at = COALESCE(v_row.parsed_date::timestamptz, now()),
    card_fee_amount = COALESCE(v_row.parsed_fee_amount, card_fee_amount, 0),
    net_amount = COALESCE(v_row.parsed_net_amount, COALESCE(v_row.parsed_amount, amount) - COALESCE(v_row.parsed_fee_amount, 0)),
    card_brand = COALESCE(v_row.parsed_brand, card_brand),
    card_nsu = COALESCE(v_row.parsed_nsu, card_nsu),
    card_authorization_code = COALESCE(v_row.parsed_auth_code, card_authorization_code),
    payment_status_updated_at = now(),
    updated_at = now()
  WHERE id = v_inst.id;

  UPDATE public.financial_import_rows SET status = 'settled' WHERE id = p_row_id;

  IF to_regclass('public.installment_events') IS NOT NULL THEN
    INSERT INTO public.installment_events (installment_id, event_type, payload, created_by)
    VALUES (
      v_inst.id,
      'settled_from_import',
      jsonb_build_object('row_id', p_row_id, 'batch_id', v_row.batch_id, 'payment_status', p_payment_status),
      auth.uid()
    );
  END IF;

  RETURN v_inst.id;
END;
$$;
