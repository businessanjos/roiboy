CREATE OR REPLACE FUNCTION public.normalize_invoice_status(_status text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text := NULLIF(TRIM(LOWER(COALESCE(_status, ''))), '');
BEGIN
  IF v IS NULL THEN
    RETURN 'active';
  END IF;

  RETURN CASE v
    WHEN 'draft' THEN 'draft'
    WHEN 'rascunho' THEN 'draft'
    WHEN 'active' THEN 'active'
    WHEN 'open' THEN 'active'
    WHEN 'opened' THEN 'active'
    WHEN 'aberta' THEN 'active'
    WHEN 'aberto' THEN 'active'
    WHEN 'pending' THEN 'active'
    WHEN 'pendente' THEN 'active'
    WHEN 'scheduled' THEN 'active'
    WHEN 'overdue' THEN 'active'
    WHEN 'vencida' THEN 'active'
    WHEN 'partial' THEN 'active'
    WHEN 'partially_paid' THEN 'active'
    WHEN 'renegotiated' THEN 'renegotiated'
    WHEN 'renegociada' THEN 'renegotiated'
    WHEN 'settled' THEN 'settled'
    WHEN 'paid' THEN 'settled'
    WHEN 'paga' THEN 'settled'
    WHEN 'quitada' THEN 'settled'
    WHEN 'written_off' THEN 'written_off'
    WHEN 'cancelled' THEN 'written_off'
    WHEN 'canceled' THEN 'written_off'
    WHEN 'cancelada' THEN 'written_off'
    WHEN 'baixada' THEN 'written_off'
    WHEN 'judicial' THEN 'judicial'
    ELSE NULL
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_invoice_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_normalized text;
BEGIN
  v_normalized := public.normalize_invoice_status(NEW.status);

  IF v_normalized IS NULL THEN
    RAISE EXCEPTION 'Status de fatura invalido: "%". Valores permitidos: draft, active, renegotiated, settled, written_off, judicial.', NEW.status
      USING ERRCODE = '22023';
  END IF;

  NEW.status := v_normalized;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_invoice_status ON public.invoices;
CREATE TRIGGER trg_enforce_invoice_status
BEFORE INSERT OR UPDATE OF status ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.enforce_invoice_status();