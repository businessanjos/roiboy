
CREATE OR REPLACE FUNCTION public.renegotiate_installment(
  p_installment_id uuid,
  p_reason text,
  p_new_installments jsonb -- array of { due_date, amount, payment_method }
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original public.installments%ROWTYPE;
  v_invoice public.invoices%ROWTYPE;
  v_item jsonb;
  v_max_number int;
  v_new_ids uuid[] := ARRAY[]::uuid[];
  v_new_entry_ids uuid[] := ARRAY[]::uuid[];
  v_new_id uuid;
  v_new_entry_id uuid;
  v_orig_entry public.financial_entries%ROWTYPE;
  v_orig_entry_found boolean := false;
  v_contract_id uuid;
  v_client_id uuid;
  v_deal_id uuid;
  v_account_id uuid;
  v_category_id uuid;
  v_cost_center_id uuid;
  v_currency text;
  v_group_id uuid;
  v_total_installments int;
  v_row_number int;
  v_row_amount numeric(14,2);
  v_row_due date;
  v_row_method text;
  v_cancelled_entry_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  SELECT * INTO v_original FROM public.installments WHERE id = p_installment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela não encontrada';
  END IF;
  IF v_original.status = 'paid' THEN
    RAISE EXCEPTION 'Parcela já paga não pode ser renegociada';
  END IF;
  IF jsonb_array_length(p_new_installments) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos uma nova parcela';
  END IF;

  SELECT * INTO v_invoice FROM public.invoices WHERE id = v_original.invoice_id;
  v_contract_id := v_invoice.contract_id;
  v_client_id   := v_invoice.client_id;
  v_deal_id     := v_invoice.deal_id;
  v_account_id  := v_original.account_id;

  -- Marca original como renegociada
  UPDATE public.installments
  SET status = 'renegotiated',
      renegotiated_at = now(),
      renegotiation_reason = p_reason,
      updated_at = now()
  WHERE id = p_installment_id;

  SELECT COALESCE(MAX(number),0) INTO v_max_number
  FROM public.installments WHERE invoice_id = v_original.invoice_id;

  -- === Sincroniza financial_entries ===
  -- 1) Localiza o lançamento financeiro correspondente à parcela original (se houver contrato vinculado)
  IF v_contract_id IS NOT NULL THEN
    SELECT * INTO v_orig_entry
    FROM public.financial_entries
    WHERE source = 'contract'
      AND source_id = v_contract_id
      AND installment_number = v_original.number
      AND status IN ('pending','overdue','partial','partially_paid')
    ORDER BY created_at
    LIMIT 1;

    v_orig_entry_found := FOUND;
  END IF;

  IF v_orig_entry_found THEN
    v_category_id    := v_orig_entry.category_id;
    v_cost_center_id := v_orig_entry.cost_center_id;
    v_currency       := COALESCE(v_orig_entry.currency, 'BRL');
    v_group_id       := COALESCE(v_orig_entry.installment_group_id, gen_random_uuid());
    v_total_installments := COALESCE(v_orig_entry.total_installments, v_max_number);
  ELSE
    -- Sem lançamento pai: monta defaults minimamente coerentes para as novas linhas.
    v_currency := 'BRL';
    v_group_id := gen_random_uuid();
    v_total_installments := v_max_number;

    -- fallback: primeira categoria de receita ativa da conta
    SELECT id INTO v_category_id
    FROM public.financial_categories
    WHERE account_id = v_account_id
      AND type IN ('income','both')
      AND is_active = true
    ORDER BY display_order, created_at
    LIMIT 1;
  END IF;

  -- 2) Cancela o lançamento financeiro original (preserva histórico, nunca deleta)
  IF v_orig_entry_found THEN
    UPDATE public.financial_entries
    SET status = 'cancelled',
        notes = COALESCE(notes || E'\n', '')
                || 'Renegociada em ' || to_char(now(),'DD/MM/YYYY HH24:MI')
                || CASE WHEN p_reason IS NOT NULL AND p_reason <> '' THEN ' — ' || p_reason ELSE '' END,
        updated_at = now()
    WHERE id = v_orig_entry.id;

    v_cancelled_entry_ids := array_append(v_cancelled_entry_ids, v_orig_entry.id);
  END IF;

  -- 3) Cria novas parcelas em installments + financial_entries em paralelo
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_new_installments) LOOP
    v_max_number := v_max_number + 1;
    v_row_number := v_max_number;
    v_row_amount := (v_item->>'amount')::numeric;
    v_row_due    := (v_item->>'due_date')::date;
    v_row_method := COALESCE(v_item->>'payment_method', v_original.payment_method);

    -- installment
    INSERT INTO public.installments (
      account_id, invoice_id, number, due_date, amount, payment_method,
      status, renegotiated_from_id, created_by, notes
    ) VALUES (
      v_account_id,
      v_original.invoice_id,
      v_row_number,
      v_row_due,
      v_row_amount,
      v_row_method,
      'pending',
      v_original.id,
      auth.uid(),
      'Renegociada de parcela #' || v_original.number
    ) RETURNING id INTO v_new_id;
    v_new_ids := array_append(v_new_ids, v_new_id);

    -- financial_entry equivalente (só se houver contrato vinculado)
    IF v_contract_id IS NOT NULL AND v_category_id IS NOT NULL THEN
      INSERT INTO public.financial_entries (
        account_id, entry_type, description, amount, due_date, status,
        client_id, contract_id, deal_id, category_id, cost_center_id,
        installment_number, total_installments, installment_group_id,
        currency, source, source_id, notes, created_by
      ) VALUES (
        v_account_id, 'receivable',
        'Parcela ' || v_row_number || ' - Contrato (renegociada)',
        v_row_amount, v_row_due,
        CASE WHEN v_row_due < CURRENT_DATE THEN 'overdue' ELSE 'pending' END,
        v_client_id, v_contract_id, v_deal_id, v_category_id, v_cost_center_id,
        v_row_number, GREATEST(v_total_installments, v_row_number), v_group_id,
        v_currency, 'contract', v_contract_id,
        'Renegociada de parcela #' || v_original.number
          || CASE WHEN p_reason IS NOT NULL AND p_reason <> '' THEN ' — ' || p_reason ELSE '' END,
        auth.uid()
      ) RETURNING id INTO v_new_entry_id;
      v_new_entry_ids := array_append(v_new_entry_ids, v_new_entry_id);
    END IF;
  END LOOP;

  -- 4) Atualiza total_installments dos lançamentos abertos do contrato para refletir o novo total.
  IF v_contract_id IS NOT NULL THEN
    UPDATE public.financial_entries
    SET total_installments = GREATEST(v_total_installments, v_max_number),
        updated_at = now()
    WHERE source = 'contract'
      AND source_id = v_contract_id
      AND status IN ('pending','overdue','partial','partially_paid');
  END IF;

  -- Evento na parcela original
  INSERT INTO public.installment_events (
    account_id, installment_id, invoice_id, event_type, payload, visible_to, created_by
  ) VALUES (
    v_original.account_id, v_original.id, v_original.invoice_id, 'renegotiated',
    jsonb_build_object(
      'reason', p_reason,
      'new_installment_ids', to_jsonb(v_new_ids),
      'new_count', array_length(v_new_ids,1),
      'financial_entries_cancelled', to_jsonb(v_cancelled_entry_ids),
      'financial_entries_created',   to_jsonb(v_new_entry_ids)
    ),
    'internal', auth.uid()
  );

  RETURN jsonb_build_object(
    'ok', true,
    'new_installment_ids', to_jsonb(v_new_ids),
    'financial_entries_created', to_jsonb(v_new_entry_ids),
    'financial_entries_cancelled', to_jsonb(v_cancelled_entry_ids)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.renegotiate_installment(uuid, text, jsonb) TO authenticated;
