
ALTER TABLE public.client_contracts
  ADD COLUMN IF NOT EXISTS payer_id uuid REFERENCES public.payers(id);

CREATE INDEX IF NOT EXISTS idx_client_contracts_payer_id
  ON public.client_contracts(payer_id);

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

  -- Prioriza o pagador escolhido no contrato; se não houver, deriva do cliente.
  IF c.payer_id IS NOT NULL THEN
    v_payer_id := c.payer_id;
  ELSE
    v_payer_id := public.ensure_payer_from_client(c.client_id);
    -- Salva no contrato para servir de referência às próximas etapas (NF, etc).
    UPDATE public.client_contracts
       SET payer_id = v_payer_id
     WHERE id = c.id;
  END IF;

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
