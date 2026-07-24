
CREATE OR REPLACE FUNCTION public.generate_contract_installments(_contract_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c RECORD; v_client RECORD; v_payer_id uuid; v_invoice_id uuid;
  v_total int; v_i int; v_amount numeric(14,2); v_due date;
  v_detail jsonb; v_detail_arr jsonb;
  v_default_method text; v_row_method text; v_raw_method text;
  v_created int := 0; v_doc text; v_existing_payer_id uuid;
  v_is_mvp boolean; v_status text; v_paid_at date; v_paid_amount numeric(14,2);
  v_is_cash_collect boolean;
BEGIN
  SELECT * INTO c FROM public.client_contracts WHERE id = _contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato não encontrado: %', _contract_id; END IF;

  SELECT id INTO v_invoice_id FROM public.invoices
  WHERE contract_id = _contract_id AND status <> 'written_off' LIMIT 1;
  IF v_invoice_id IS NOT NULL THEN
    RETURN jsonb_build_object('invoice_id', v_invoice_id, 'created', 0, 'skipped', true);
  END IF;

  v_is_mvp := public.contract_is_mvp(_contract_id);
  v_total := GREATEST(COALESCE(c.installments_count, 1), 1);
  v_detail_arr := COALESCE(c.installments_detail, '[]'::jsonb);

  v_default_method := CASE COALESCE(c.payment_method, 'pix')
    WHEN 'cartao' THEN 'credit_card' WHEN 'credit_card' THEN 'credit_card'
    WHEN 'cartao_credito' THEN 'credit_card' WHEN 'boleto' THEN 'boleto'
    WHEN 'pix' THEN 'pix' WHEN 'cheque' THEN 'check'
    WHEN 'transferencia' THEN 'transfer' WHEN 'dinheiro' THEN 'cash'
    WHEN 'entrada' THEN 'other' ELSE 'other'
  END;

  IF c.payer_id IS NOT NULL THEN
    v_payer_id := c.payer_id;
  ELSE
    SELECT * INTO v_client FROM public.clients WHERE id = c.client_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado: %', c.client_id; END IF;
    SELECT cp.payer_id INTO v_existing_payer_id FROM public.client_payers cp
    WHERE cp.client_id = c.client_id AND cp.is_default = true LIMIT 1;
    IF v_existing_payer_id IS NOT NULL THEN
      v_payer_id := v_existing_payer_id;
    ELSE
      v_doc := regexp_replace(COALESCE(NULLIF(v_client.cnpj,''), v_client.cpf, ''), '[^0-9]', '', 'g');
      IF length(v_doc) IN (11, 14) THEN
        v_payer_id := public.ensure_payer_from_client(c.client_id);
      ELSE
        v_doc := 'sem-doc-' || c.client_id::text;
        SELECT id INTO v_payer_id FROM public.payers
        WHERE account_id = c.account_id AND document = v_doc LIMIT 1;
        IF v_payer_id IS NULL THEN
          INSERT INTO public.payers (
            account_id, company_id, document_type, document, legal_name,
            email_billing, phone_billing, notes
          ) VALUES (
            c.account_id, NULL, 'cpf', v_doc,
            COALESCE(NULLIF(v_client.company_name, ''), NULLIF(v_client.full_name, ''), 'Cliente sem documento'),
            NULL, v_client.phone_e164,
            'Pagador operacional criado automaticamente para geração de parcelas; revisar CPF/CNPJ antes de emissão fiscal.'
          ) RETURNING id INTO v_payer_id;
        END IF;
        INSERT INTO public.client_payers (account_id, client_id, payer_id, relationship, is_default)
        VALUES (c.account_id, c.client_id, v_payer_id, 'self', true)
        ON CONFLICT (client_id, payer_id) DO UPDATE SET is_default = true;
      END IF;
    END IF;
    UPDATE public.client_contracts SET payer_id = v_payer_id WHERE id = c.id;
  END IF;

  INSERT INTO public.invoices (
    account_id, deal_id, contract_id, client_id, payer_id, product_id,
    description, total_amount, currency, status, opened_at
  ) VALUES (
    c.account_id, c.deal_id, c.id, c.client_id, v_payer_id, c.product_id,
    'Fatura contrato ' || c.id::text, c.value, COALESCE(c.currency,'BRL'), 'open', now()
  ) RETURNING id INTO v_invoice_id;

  FOR v_i IN 1..v_total LOOP
    IF jsonb_array_length(v_detail_arr) >= v_i THEN
      v_detail := v_detail_arr->(v_i - 1);
      v_amount := COALESCE((v_detail->>'amount')::numeric, ROUND(c.value / v_total, 2));
      v_due := COALESCE(
        (v_detail->>'due_date')::date,
        (COALESCE(c.first_due_date, c.start_date, CURRENT_DATE) + ((v_i - 1) || ' months')::interval)::date
      );
      v_raw_method := NULLIF(TRIM(LOWER(COALESCE(v_detail->>'method', ''))), '');
      v_is_cash_collect := COALESCE((v_detail->>'is_cash_collect')::boolean, false);
    ELSE
      v_amount := ROUND(c.value::numeric / v_total, 2);
      v_due := (COALESCE(c.first_due_date, c.start_date, CURRENT_DATE) + ((v_i - 1) || ' months')::interval)::date;
      v_raw_method := NULL;
      v_is_cash_collect := false;
    END IF;

    v_row_method := CASE v_raw_method
      WHEN 'cartao' THEN 'credit_card' WHEN 'credit_card' THEN 'credit_card'
      WHEN 'cartao_credito' THEN 'credit_card' WHEN 'cartao_debito' THEN 'debit_card'
      WHEN 'debit_card' THEN 'debit_card' WHEN 'boleto' THEN 'boleto'
      WHEN 'pix' THEN 'pix' WHEN 'cheque' THEN 'check' WHEN 'check' THEN 'check'
      WHEN 'transferencia' THEN 'transfer' WHEN 'transfer' THEN 'transfer'
      WHEN 'ted' THEN 'transfer' WHEN 'doc' THEN 'transfer'
      WHEN 'dinheiro' THEN 'cash' WHEN 'cash' THEN 'cash'
      WHEN 'entrada' THEN v_default_method WHEN NULL THEN v_default_method
      ELSE COALESCE(v_raw_method, v_default_method)
    END;
    IF v_row_method IS NULL OR v_row_method = '' THEN v_row_method := v_default_method; END IF;

    IF v_is_cash_collect THEN
      v_status := 'paid';
      v_paid_at := CURRENT_DATE;
      v_paid_amount := v_amount;
    ELSIF v_is_mvp AND v_row_method = 'credit_card' THEN
      v_status := 'paid';
      v_paid_at := COALESCE(c.start_date, CURRENT_DATE);
      v_paid_amount := v_amount;
    ELSE
      v_status := CASE WHEN v_due < CURRENT_DATE THEN 'overdue' ELSE 'pending' END;
      v_paid_at := NULL; v_paid_amount := 0;
    END IF;

    INSERT INTO public.installments (
      account_id, invoice_id, number, due_date, amount, payment_method, status,
      paid_at, paid_amount
    ) VALUES (
      c.account_id, v_invoice_id, v_i, v_due, v_amount, v_row_method, v_status,
      v_paid_at, v_paid_amount
    );
    v_created := v_created + 1;
  END LOOP;

  RETURN jsonb_build_object('invoice_id', v_invoice_id, 'created', v_created, 'skipped', false);
END;
$function$;


CREATE OR REPLACE FUNCTION public.generate_contract_receivables(_contract_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  fallback_category_id uuid;
  v_is_cash_collect boolean;
  v_status text;
  v_payment_date date;
BEGIN
  SELECT * INTO c FROM public.client_contracts WHERE id = _contract_id;
  IF NOT FOUND OR c.receivables_generated IS NOT TRUE THEN
    RETURN 0;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.financial_entries
    WHERE source = 'contract' AND source_id = _contract_id
  ) THEN
    RETURN 0;
  END IF;

  SELECT id INTO fallback_category_id
  FROM public.financial_categories
  WHERE account_id = c.account_id
    AND type IN ('income','both')
    AND is_active = true
  ORDER BY display_order, created_at
  LIMIT 1;

  IF fallback_category_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma categoria de receita ativa encontrada. Cadastre uma categoria de receita no plano de contas antes de conciliar.';
  END IF;

  total := COALESCE(c.installments_count, 1);
  IF total < 1 THEN total := 1; END IF;

  group_id := gen_random_uuid();
  detail_arr := COALESCE(c.installments_detail, '[]'::jsonb);

  FOR i IN 1..total LOOP
    IF jsonb_array_length(detail_arr) >= i THEN
      detail := detail_arr->(i-1);
      installment_amount := COALESCE((detail->>'amount')::numeric, c.value / total);
      due := COALESCE(
        (detail->>'due_date')::date,
        (COALESCE(c.first_due_date, c.start_date, CURRENT_DATE) + ((i-1) || ' months')::interval)::date
      );
      v_is_cash_collect := COALESCE((detail->>'is_cash_collect')::boolean, false);
    ELSE
      installment_amount := ROUND(c.value::numeric / total, 2);
      due := (COALESCE(c.first_due_date, c.start_date, CURRENT_DATE) + ((i-1) || ' months')::interval)::date;
      v_is_cash_collect := false;
    END IF;

    IF v_is_cash_collect THEN
      v_status := 'paid';
      v_payment_date := CURRENT_DATE;
    ELSE
      v_status := CASE WHEN due < CURRENT_DATE THEN 'overdue' ELSE 'pending' END;
      v_payment_date := NULL;
    END IF;

    INSERT INTO public.financial_entries (
      account_id, entry_type, description, amount, due_date, status,
      payment_date,
      client_id, contract_id, deal_id, category_id,
      installment_number, total_installments, installment_group_id,
      currency, source, source_id
    ) VALUES (
      c.account_id, 'receivable',
      'Parcela ' || i || '/' || total || ' - Contrato',
      installment_amount, due,
      v_status,
      v_payment_date,
      c.client_id, c.id, c.deal_id, fallback_category_id,
      i, total, group_id,
      COALESCE(c.currency, 'BRL'), 'contract', c.id
    );
    created_count := created_count + 1;
  END LOOP;

  RETURN created_count;
END;
$function$;
