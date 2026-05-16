
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS nf_number text,
  ADD COLUMN IF NOT EXISTS nf_series text,
  ADD COLUMN IF NOT EXISTS nf_issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS nf_url text,
  ADD COLUMN IF NOT EXISTS nf_status text CHECK (nf_status IS NULL OR nf_status IN ('issued','cancelled')),
  ADD COLUMN IF NOT EXISTS nf_cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS nf_cancellation_reason text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_nf_number_unique
  ON public.invoices (account_id, nf_series, nf_number)
  WHERE nf_number IS NOT NULL AND nf_status = 'issued';

-- Extend immutability: NF number/issued_at can't be changed once set (unless explicit cancel)
CREATE OR REPLACE FUNCTION public.invoices_enforce_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.locked = true THEN
    IF (NEW.total_amount IS DISTINCT FROM OLD.total_amount) THEN
      RAISE EXCEPTION 'Não é permitido alterar total_amount em fatura travada (id=%). Crie uma renegociação.', OLD.id;
    END IF;
    IF (NEW.client_id IS DISTINCT FROM OLD.client_id) THEN
      RAISE EXCEPTION 'Não é permitido alterar client_id em fatura travada (id=%).', OLD.id;
    END IF;
    IF (NEW.payer_id IS DISTINCT FROM OLD.payer_id) THEN
      RAISE EXCEPTION 'Não é permitido alterar payer_id em fatura travada (id=%).', OLD.id;
    END IF;
    IF (NEW.opened_at IS DISTINCT FROM OLD.opened_at) THEN
      RAISE EXCEPTION 'Não é permitido alterar opened_at em fatura travada (id=%).', OLD.id;
    END IF;
    IF (NEW.service_pct IS DISTINCT FROM OLD.service_pct
        OR NEW.product_pct IS DISTINCT FROM OLD.product_pct) THEN
      RAISE EXCEPTION 'Não é permitido alterar split serviço/produto em fatura travada (id=%).', OLD.id;
    END IF;
  END IF;

  -- NF fiscal: número e emissão são imutáveis após emissão
  IF OLD.nf_status = 'issued' THEN
    IF (NEW.nf_number IS DISTINCT FROM OLD.nf_number)
       AND NOT (NEW.nf_status = 'cancelled' AND NEW.nf_number IS NULL) THEN
      RAISE EXCEPTION 'Número da NF é imutável após emissão (id=%). Use a função cancel_fiscal_invoice.', OLD.id;
    END IF;
    IF (NEW.nf_issued_at IS DISTINCT FROM OLD.nf_issued_at)
       AND NOT (NEW.nf_status = 'cancelled') THEN
      RAISE EXCEPTION 'Data de emissão da NF é imutável (id=%).', OLD.id;
    END IF;
    IF (NEW.nf_series IS DISTINCT FROM OLD.nf_series)
       AND NOT (NEW.nf_status = 'cancelled' AND NEW.nf_series IS NULL) THEN
      RAISE EXCEPTION 'Série da NF é imutável após emissão (id=%).', OLD.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- RPC: emitir NF (registra número + trava fatura)
CREATE OR REPLACE FUNCTION public.issue_fiscal_invoice(
  p_invoice_id uuid,
  p_nf_number text,
  p_nf_series text DEFAULT NULL,
  p_nf_url text DEFAULT NULL,
  p_issued_at timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acc uuid;
  v_existing text;
BEGIN
  SELECT account_id, nf_number INTO v_acc, v_existing
  FROM public.invoices WHERE id = p_invoice_id;

  IF v_acc IS NULL THEN
    RAISE EXCEPTION 'Fatura não encontrada';
  END IF;
  IF v_acc <> get_user_account_id() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Fatura já possui NF emitida (%). Cancele antes de reemitir.', v_existing;
  END IF;
  IF p_nf_number IS NULL OR length(btrim(p_nf_number)) = 0 THEN
    RAISE EXCEPTION 'Número da NF é obrigatório';
  END IF;

  UPDATE public.invoices
  SET nf_number = btrim(p_nf_number),
      nf_series = NULLIF(btrim(p_nf_series), ''),
      nf_url = NULLIF(btrim(p_nf_url), ''),
      nf_issued_at = COALESCE(p_issued_at, now()),
      nf_status = 'issued',
      nf_cancelled_at = NULL,
      nf_cancellation_reason = NULL,
      locked = true,
      locked_at = COALESCE(locked_at, now())
  WHERE id = p_invoice_id;

  RETURN p_invoice_id;
END;
$$;

-- RPC: cancelar NF (admin) — só se não houver parcelas pagas
CREATE OR REPLACE FUNCTION public.cancel_fiscal_invoice(
  p_invoice_id uuid,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acc uuid;
  v_paid int;
BEGIN
  SELECT account_id INTO v_acc FROM public.invoices WHERE id = p_invoice_id;
  IF v_acc IS NULL THEN RAISE EXCEPTION 'Fatura não encontrada'; END IF;
  IF v_acc <> get_user_account_id() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Motivo do cancelamento é obrigatório (mínimo 5 caracteres)';
  END IF;

  SELECT COUNT(*) INTO v_paid FROM public.installments
   WHERE invoice_id = p_invoice_id AND status = 'paid';
  IF v_paid > 0 THEN
    RAISE EXCEPTION 'Não é possível cancelar NF de fatura com parcelas já pagas';
  END IF;

  UPDATE public.invoices
  SET nf_status = 'cancelled',
      nf_cancelled_at = now(),
      nf_cancellation_reason = btrim(p_reason),
      locked = false
  WHERE id = p_invoice_id;

  RETURN p_invoice_id;
END;
$$;
