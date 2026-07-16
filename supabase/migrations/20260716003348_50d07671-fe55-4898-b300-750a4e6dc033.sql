CREATE OR REPLACE FUNCTION public.generate_contract_installments(_contract_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c RECORD;
  v_client RECORD;
  v_payer_id uuid;
  v_invoice_id uuid;
  v_total int;
  v_i int;
  v_amount numeric(14,2);
  v_due date;
  v_detail jsonb;
  v_detail_arr jsonb;
  v_default_method text;
  v_row_method text;
  v_raw_method text;
  v_created int := 0;
  v_doc text;
  v_existing_payer_id uuid;
BEGIN
  SELECT * INTO c FROM public.client_contracts WHERE id = _contract_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato não encontrado: %', _contract_id;
  END IF;

  -- Idempotência
  SELECT id INTO v_invoice_id
  FROM public.invoices
  WHERE contract_id = _contract_id AND status <> 'written_off'
  LIMIT 1;

  IF v_invoice_id IS NOT NULL THEN
    RETURN jsonb_build_object('invoice_id', v_invoice_id, 'created', 0, 'skipped', true);
  END IF;

  v_total := GREATEST(COALESCE(c.installments_count, 1), 1);
  v_detail_arr := COALESCE(c.installments_detail, '[]'::jsonb);

  v_default_method := CASE COALESCE(c.payment_method, 'pix')
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

  -- Payer: prioriza o contrato; se vazio, tenta derivar do cliente.
  -- Se o cliente ainda não tiver CPF/CNPJ, cria um pagador operacional temporário
  -- para não bloquear a visibilidade financeira. A emissão fiscal deve ser revisada
  -- depois com um documento válido.
  IF c.payer_id IS NOT NULL THEN
    v_payer_id := c.payer_id;
  ELSE
    SELECT * INTO v_client FROM public.clients WHERE id = c.client_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente não encontrado: %', c.client_id;
    END IF;

    SELECT cp.payer_id INTO v_existing_payer_id
    FROM public.client_payers cp
    WHERE cp.client_id = c.client_id AND cp.is_default = true
    LIMIT 1;

    IF v_existing_payer_id IS NOT NULL THEN
      v_payer_id := v_existing_payer_id;
    ELSE
      v_doc := regexp_replace(COALESCE(NULLIF(v_client.cnpj,''), v_client.cpf, ''), '[^0-9]', '', 'g');

      IF length(v_doc) IN (11, 14) THEN
        v_payer_id := public.ensure_payer_from_client(c.client_id);
      ELSE
        v_doc := 'sem-doc-' || c.client_id::text;

        SELECT id INTO v_payer_id
        FROM public.payers
        WHERE account_id = c.account_id AND document = v_doc
        LIMIT 1;

        IF v_payer_id IS NULL THEN
          INSERT INTO public.payers (
            account_id,
            company_id,
            document_type,
            document,
            legal_name,
            email_billing,
            phone_billing,
            notes
          ) VALUES (
            c.account_id,
            c.company_id,
            'cpf',
            v_doc,
            COALESCE(NULLIF(v_client.company_name, ''), NULLIF(v_client.full_name, ''), 'Cliente sem documento'),
            NULL,
            v_client.phone_e164,
            'Pagador operacional criado automaticamente para geração de parcelas; revisar CPF/CNPJ antes de emissão fiscal.'
          )
          RETURNING id INTO v_payer_id;
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
      v_raw_method := NULLIF(TRIM(LOWER(COALESCE(v_detail->>'method', ''))), '');
    ELSE
      v_amount := ROUND(c.value::numeric / v_total, 2);
      v_due := (COALESCE(c.first_due_date, c.start_date, CURRENT_DATE) + ((v_i - 1) || ' months')::interval)::date;
      v_raw_method := NULL;
    END IF;

    v_row_method := CASE v_raw_method
      WHEN 'cartao' THEN 'credit_card'
      WHEN 'credit_card' THEN 'credit_card'
      WHEN 'cartao_credito' THEN 'credit_card'
      WHEN 'cartao_debito' THEN 'debit_card'
      WHEN 'debit_card' THEN 'debit_card'
      WHEN 'boleto' THEN 'boleto'
      WHEN 'pix' THEN 'pix'
      WHEN 'cheque' THEN 'check'
      WHEN 'check' THEN 'check'
      WHEN 'transferencia' THEN 'transfer'
      WHEN 'transfer' THEN 'transfer'
      WHEN 'ted' THEN 'transfer'
      WHEN 'doc' THEN 'transfer'
      WHEN 'dinheiro' THEN 'cash'
      WHEN 'cash' THEN 'cash'
      WHEN 'entrada' THEN v_default_method
      WHEN NULL THEN v_default_method
      ELSE COALESCE(v_raw_method, v_default_method)
    END;

    IF v_row_method IS NULL OR v_row_method = '' THEN
      v_row_method := v_default_method;
    END IF;

    INSERT INTO public.installments (
      account_id, invoice_id, number, due_date, amount, payment_method, status
    ) VALUES (
      c.account_id, v_invoice_id, v_i, v_due, v_amount, v_row_method,
      CASE WHEN v_due < CURRENT_DATE THEN 'overdue' ELSE 'pending' END
    );
    v_created := v_created + 1;
  END LOOP;

  RETURN jsonb_build_object('invoice_id', v_invoice_id, 'created', v_created, 'skipped', false);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.generate_contract_installments(uuid) TO authenticated, service_role;