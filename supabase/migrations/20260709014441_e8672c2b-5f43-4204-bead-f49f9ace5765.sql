
-- 1) Nova RPC: gera invoice + installments a partir de client_contracts (idempotente)
CREATE OR REPLACE FUNCTION public.generate_contract_installments(_contract_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  v_payer_id uuid;
  v_invoice_id uuid;
  v_total int;
  v_i int;
  v_amount numeric(14,2);
  v_due date;
  v_detail jsonb;
  v_detail_arr jsonb;
  v_method text;
  v_created int := 0;
BEGIN
  SELECT * INTO c FROM public.client_contracts WHERE id = _contract_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato não encontrado: %', _contract_id;
  END IF;

  -- Idempotência: se já existe invoice não-cancelada para o contrato, retorna
  SELECT id INTO v_invoice_id
  FROM public.invoices
  WHERE contract_id = _contract_id AND status <> 'written_off'
  LIMIT 1;

  IF v_invoice_id IS NOT NULL THEN
    RETURN jsonb_build_object('invoice_id', v_invoice_id, 'created', 0, 'skipped', true);
  END IF;

  v_total := GREATEST(COALESCE(c.installments_count, 1), 1);
  v_detail_arr := COALESCE(c.installments_detail, '[]'::jsonb);
  v_method := CASE COALESCE(c.payment_method, 'pix')
    WHEN 'cartao' THEN 'credit_card'
    WHEN 'credit_card' THEN 'credit_card'
    WHEN 'cartao_credito' THEN 'credit_card'
    WHEN 'boleto' THEN 'boleto'
    WHEN 'pix' THEN 'pix'
    WHEN 'cheque' THEN 'check'
    WHEN 'transferencia' THEN 'transfer'
    WHEN 'dinheiro' THEN 'cash'
    ELSE 'other'
  END;

  -- Garante payer
  v_payer_id := public.ensure_payer_from_client(c.client_id);

  -- Cria invoice
  INSERT INTO public.invoices (
    account_id, deal_id, contract_id, client_id, payer_id, product_id,
    description, total_amount, currency, status, opened_at
  ) VALUES (
    c.account_id, c.deal_id, c.id, c.client_id, v_payer_id, c.product_id,
    'Contrato ' || COALESCE(c.contract_type, 'compra'),
    c.value, COALESCE(c.currency, 'BRL'), 'active', now()
  )
  RETURNING id INTO v_invoice_id;

  FOR v_i IN 1..v_total LOOP
    IF jsonb_array_length(v_detail_arr) >= v_i THEN
      v_detail := v_detail_arr->(v_i - 1);
      v_amount := COALESCE((v_detail->>'amount')::numeric, ROUND(c.value / v_total, 2));
      v_due := COALESCE(
        (v_detail->>'due_date')::date,
        (COALESCE(c.first_due_date, c.start_date, CURRENT_DATE) + ((v_i - 1) || ' months')::interval)::date
      );
    ELSE
      v_amount := ROUND(c.value::numeric / v_total, 2);
      v_due := (COALESCE(c.first_due_date, c.start_date, CURRENT_DATE) + ((v_i - 1) || ' months')::interval)::date;
    END IF;

    INSERT INTO public.installments (
      account_id, invoice_id, number, due_date, amount, payment_method, status
    ) VALUES (
      c.account_id, v_invoice_id, v_i, v_due, v_amount, v_method,
      CASE WHEN v_due < CURRENT_DATE THEN 'overdue' ELSE 'pending' END
    );
    v_created := v_created + 1;
  END LOOP;

  RETURN jsonb_build_object('invoice_id', v_invoice_id, 'created', v_created, 'skipped', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_contract_installments(uuid) TO authenticated, service_role;

-- 2) Estender trigger: quando receivables_generated vira true, cria também invoice+installments
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
    PERFORM public.generate_contract_installments(NEW.id);
  END IF;

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

-- 3) Estender handle_contract_cancellation para casar também via invoice.contract_id
CREATE OR REPLACE FUNCTION public.handle_contract_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text;
  v_inst record;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('cancelled','dismissal_termination','dropout_7d') THEN
    RETURN NEW;
  END IF;

  v_reason := COALESCE(NEW.cancellation_reason, NEW.status_reason, 'Contrato cancelado');

  NEW.payment_status := 'cancelado';
  NEW.payment_status_updated_at := now();

  FOR v_inst IN
    SELECT i.* FROM public.installments i
    JOIN public.invoices inv ON inv.id = i.invoice_id
    WHERE (inv.contract_id = NEW.id OR (NEW.deal_id IS NOT NULL AND inv.deal_id = NEW.deal_id))
      AND i.status IN ('pending','scheduled','overdue')
  LOOP
    UPDATE public.installments
       SET status = 'written_off',
           notes = COALESCE(notes || E'\n', '') || 'Write-off por cancelamento: ' || v_reason,
           updated_at = now()
     WHERE id = v_inst.id;

    INSERT INTO public.installment_events
      (account_id, invoice_id, installment_id, event_type, description, visible_to, metadata)
    VALUES
      (NEW.account_id, v_inst.invoice_id, v_inst.id, 'cancellation_writeoff',
       'Parcela baixada por cancelamento de contrato: ' || v_reason, 'all',
       jsonb_build_object('contract_id', NEW.id, 'reason', v_reason));
  END LOOP;

  RETURN NEW;
END;
$$;

-- 4) Enforce motivo obrigatório em cancelamento (nível DB — proteção contra bypass do UI)
CREATE OR REPLACE FUNCTION public.enforce_contract_cancellation_reason()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('cancelled','dismissal_termination','dropout_7d','suspended','paused')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND (NEW.cancellation_reason IS NULL OR btrim(NEW.cancellation_reason) = '') THEN
    RAISE EXCEPTION 'Motivo (cancellation_reason) é obrigatório ao mover contrato para status %', NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_contract_cancellation_reason ON public.client_contracts;
CREATE TRIGGER trg_enforce_contract_cancellation_reason
BEFORE UPDATE ON public.client_contracts
FOR EACH ROW EXECUTE FUNCTION public.enforce_contract_cancellation_reason();
