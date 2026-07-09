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
  fallback_category_id uuid;
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

  -- Pick a fallback income category so the required-category trigger doesn't block auto generation
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
    ELSE
      installment_amount := ROUND(c.value::numeric / total, 2);
      due := (COALESCE(c.first_due_date, c.start_date, CURRENT_DATE) + ((i-1) || ' months')::interval)::date;
    END IF;

    INSERT INTO public.financial_entries (
      account_id, entry_type, description, amount, due_date, status,
      client_id, contract_id, deal_id, category_id,
      installment_number, total_installments, installment_group_id,
      currency, source, source_id
    ) VALUES (
      c.account_id, 'receivable',
      'Parcela ' || i || '/' || total || ' - Contrato',
      installment_amount, due,
      CASE WHEN due < CURRENT_DATE THEN 'overdue' ELSE 'pending' END,
      c.client_id, c.id, c.deal_id, fallback_category_id,
      i, total, group_id,
      COALESCE(c.currency, 'BRL'), 'contract', c.id
    );
    created_count := created_count + 1;
  END LOOP;

  RETURN created_count;
END;
$$;