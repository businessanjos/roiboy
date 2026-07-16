
CREATE OR REPLACE FUNCTION public.regenerate_invoice_from_entries(
  _contract_id uuid,
  _dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  v_payer_id uuid;
  v_existing_invoice_id uuid;
  v_paid_count int := 0;
  v_new_invoice_id uuid;
  v_total numeric(14,2);
  v_count int;
  v_entry RECORD;
  v_num int := 0;
  v_method text;
  v_ist_status text;
  v_cur_count int;
  v_cur_total numeric(14,2);
BEGIN
  SELECT * INTO c FROM public.client_contracts WHERE id = _contract_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato não encontrado: %', _contract_id;
  END IF;

  -- Aggregate historical entries (skip templates created by generate_contract_installments)
  SELECT COUNT(*), COALESCE(SUM(amount),0)::numeric(14,2)
    INTO v_count, v_total
  FROM public.financial_entries
  WHERE contract_id = _contract_id
    AND entry_type = 'receivable'
    AND description NOT LIKE 'Parcela %/% - Contrato%';

  IF v_count = 0 THEN
    RETURN jsonb_build_object('status','no_entries','contract_id',_contract_id);
  END IF;

  -- Find current invoice for this contract (non-written-off)
  SELECT id INTO v_existing_invoice_id
  FROM public.invoices
  WHERE contract_id = _contract_id AND status <> 'written_off'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_invoice_id IS NOT NULL THEN
    -- Protection: refuse if any installment has payments recorded
    SELECT COUNT(*) INTO v_paid_count
    FROM public.installments
    WHERE invoice_id = v_existing_invoice_id
      AND (status IN ('paid','partially_paid') OR COALESCE(paid_amount,0) > 0);

    IF v_paid_count > 0 THEN
      RETURN jsonb_build_object(
        'status','has_paid',
        'paid_count',v_paid_count,
        'invoice_id',v_existing_invoice_id,
        'message','Fatura atual possui parcelas pagas ou com valor recebido — regeneração bloqueada para evitar perda de dados.'
      );
    END IF;

    -- Idempotency: current plan already matches historical plan
    SELECT COUNT(*), COALESCE(SUM(amount),0)::numeric(14,2)
      INTO v_cur_count, v_cur_total
    FROM public.installments
    WHERE invoice_id = v_existing_invoice_id;

    IF v_cur_count = v_count AND ABS(v_cur_total - v_total) < 0.01 THEN
      RETURN jsonb_build_object(
        'status','already_matches',
        'invoice_id',v_existing_invoice_id,
        'installments',v_cur_count,
        'total',v_cur_total
      );
    END IF;

    IF _dry_run THEN
      RETURN jsonb_build_object(
        'status','would_regenerate',
        'invoice_id',v_existing_invoice_id,
        'from_count',v_cur_count,
        'from_total',v_cur_total,
        'to_count',v_count,
        'to_total',v_total
      );
    END IF;

    -- Wipe empty invoice + installments to recreate from scratch
    DELETE FROM public.installments WHERE invoice_id = v_existing_invoice_id;
    DELETE FROM public.invoices WHERE id = v_existing_invoice_id;
  ELSIF _dry_run THEN
    RETURN jsonb_build_object(
      'status','would_create',
      'to_count',v_count,
      'to_total',v_total
    );
  END IF;

  -- Resolve payer (mirror generate_contract_installments)
  IF c.payer_id IS NOT NULL THEN
    v_payer_id := c.payer_id;
  ELSE
    SELECT cp.payer_id INTO v_payer_id
    FROM public.client_payers cp
    WHERE cp.client_id = c.client_id AND cp.is_default = true
    LIMIT 1;
    IF v_payer_id IS NULL THEN
      v_payer_id := public.ensure_payer_from_client(c.client_id);
    END IF;
  END IF;

  v_method := CASE COALESCE(c.payment_method,'pix')
    WHEN 'cartao' THEN 'credit_card'
    WHEN 'credit_card' THEN 'credit_card'
    WHEN 'cartao_credito' THEN 'credit_card'
    WHEN 'boleto' THEN 'boleto'
    WHEN 'pix' THEN 'pix'
    WHEN 'cheque' THEN 'check'
    WHEN 'transferencia' THEN 'transfer'
    WHEN 'dinheiro' THEN 'cash'
    WHEN 'entrada' THEN 'other'
    ELSE 'other'
  END;

  INSERT INTO public.invoices (
    account_id, company_id, deal_id, contract_id, client_id, payer_id, product_id,
    description, total_amount, currency, service_pct, product_pct, status
  ) VALUES (
    c.account_id, c.company_id, c.deal_id, c.id, c.client_id, v_payer_id, c.product_id,
    'Regenerada do histórico de lançamentos', v_total, 'BRL', 0, 100, 'active'
  ) RETURNING id INTO v_new_invoice_id;

  FOR v_entry IN
    SELECT amount, due_date, status, payment_date
    FROM public.financial_entries
    WHERE contract_id = _contract_id
      AND entry_type = 'receivable'
      AND description NOT LIKE 'Parcela %/% - Contrato%'
    ORDER BY due_date, created_at
  LOOP
    v_num := v_num + 1;
    v_ist_status := CASE
      WHEN v_entry.status = 'paid' THEN 'paid'
      WHEN v_entry.status = 'partially_paid' THEN 'partially_paid'
      WHEN v_entry.status = 'overdue' THEN 'overdue'
      WHEN v_entry.due_date < CURRENT_DATE THEN 'overdue'
      ELSE 'pending'
    END;

    INSERT INTO public.installments (
      account_id, invoice_id, number, due_date, amount, payment_method, status,
      paid_at, paid_amount
    ) VALUES (
      c.account_id, v_new_invoice_id, v_num, v_entry.due_date, v_entry.amount, v_method, v_ist_status,
      v_entry.payment_date,
      CASE WHEN v_entry.status = 'paid' THEN v_entry.amount ELSE 0 END
    );
  END LOOP;

  RETURN jsonb_build_object(
    'status','regenerated',
    'invoice_id',v_new_invoice_id,
    'installments',v_count,
    'total',v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.regenerate_invoice_from_entries(uuid, boolean) TO authenticated, service_role;
