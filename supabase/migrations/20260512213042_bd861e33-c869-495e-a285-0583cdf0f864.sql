
-- 1. Novos campos em financial_entries
ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.omie_settings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS deal_id uuid,
  ADD COLUMN IF NOT EXISTS omie_payload jsonb,
  ADD COLUMN IF NOT EXISTS last_omie_sync_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.financial_entries
    ADD CONSTRAINT financial_entries_source_check
    CHECK (source IN ('manual','omie','contract','deal'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_entries_account_omie
  ON public.financial_entries(account_id, omie_id) WHERE omie_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_entries_source
  ON public.financial_entries(account_id, source, source_id);

CREATE INDEX IF NOT EXISTS idx_financial_entries_company
  ON public.financial_entries(company_id);

CREATE INDEX IF NOT EXISTS idx_financial_entries_deal
  ON public.financial_entries(deal_id);

-- 2. Função: gerar parcelas a receber a partir de contrato
CREATE OR REPLACE FUNCTION public.generate_contract_receivables(_contract_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  group_id uuid;
  total int;
  i int;
  installment_amount numeric;
  due date;
  detail jsonb;
  created_count int := 0;
  detail_arr jsonb;
BEGIN
  SELECT * INTO c FROM public.client_contracts WHERE id = _contract_id;
  IF NOT FOUND OR c.receivables_generated IS NOT TRUE THEN
    RETURN 0;
  END IF;

  -- Skip if entries already exist
  IF EXISTS (
    SELECT 1 FROM public.financial_entries
    WHERE source = 'contract' AND source_id = _contract_id
  ) THEN
    RETURN 0;
  END IF;

  total := COALESCE(c.installments_count, 1);
  IF total < 1 THEN total := 1; END IF;

  group_id := gen_random_uuid();
  detail_arr := COALESCE(c.installments_detail, '[]'::jsonb);

  FOR i IN 1..total LOOP
    -- Use installments_detail if present
    IF jsonb_array_length(detail_arr) >= i THEN
      detail := detail_arr->(i-1);
      installment_amount := COALESCE((detail->>'amount')::numeric, c.value / total);
      due := COALESCE(
        (detail->>'due_date')::date,
        (COALESCE(c.first_due_date, c.start_date, CURRENT_DATE) + ((i-1) || ' months')::interval)::date
      );
    ELSE
      installment_amount := ROUND(c.value::numeric / total, 2);
      due := (COALESCE(c.first_due_date, c.start_date, CURRENT_DATE) + ((i-1) || ' months')::interval)::date;
    END IF;

    INSERT INTO public.financial_entries (
      account_id, entry_type, description, amount, due_date, status,
      client_id, contract_id, deal_id,
      installment_number, total_installments, installment_group_id,
      currency, source, source_id
    ) VALUES (
      c.account_id, 'receivable',
      'Parcela ' || i || '/' || total || ' - Contrato',
      installment_amount, due,
      CASE WHEN due < CURRENT_DATE THEN 'overdue' ELSE 'pending' END,
      c.client_id, c.id, c.deal_id,
      i, total, group_id,
      COALESCE(c.currency, 'BRL'), 'contract', c.id
    );
    created_count := created_count + 1;
  END LOOP;

  RETURN created_count;
END;
$$;

-- 3. Trigger: ao marcar/atualizar contrato com receivables_generated
CREATE OR REPLACE FUNCTION public.tg_contract_generate_receivables()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.receivables_generated IS TRUE
     AND (TG_OP = 'INSERT' OR OLD.receivables_generated IS DISTINCT FROM NEW.receivables_generated) THEN
    PERFORM public.generate_contract_receivables(NEW.id);
  END IF;

  -- Cancela parcelas futuras se contrato vira cancelado
  IF TG_OP = 'UPDATE'
     AND NEW.status IN ('cancelled','cancelado')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.financial_entries
       SET status = 'cancelled', updated_at = now()
     WHERE source = 'contract' AND source_id = NEW.id
       AND status = 'pending' AND due_date >= CURRENT_DATE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contract_generate_receivables ON public.client_contracts;
CREATE TRIGGER contract_generate_receivables
  AFTER INSERT OR UPDATE ON public.client_contracts
  FOR EACH ROW EXECUTE FUNCTION public.tg_contract_generate_receivables();

-- 4. Backfill (chunk safe — função decide se cria)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.client_contracts
    WHERE receivables_generated IS TRUE
      AND status NOT IN ('cancelled','cancelado')
  LOOP
    PERFORM public.generate_contract_receivables(r.id);
  END LOOP;
END $$;
