CREATE OR REPLACE FUNCTION public.regenerate_contract_receivables(_contract_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  paid_count int;
  created_count int;
  v_invoice_ids uuid[];
BEGIN
  SELECT * INTO c FROM public.client_contracts WHERE id = _contract_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato não encontrado';
  END IF;

  -- Safety: do not replace real payment history.
  SELECT count(*) INTO paid_count
  FROM public.installments i
  JOIN public.invoices inv ON inv.id = i.invoice_id
  WHERE inv.contract_id = _contract_id
    AND inv.status <> 'written_off'
    AND (
      i.status IN ('paid', 'partial')
      OR i.paid_at IS NOT NULL
      OR COALESCE(i.paid_amount, 0) > 0
    );

  IF paid_count > 0 THEN
    RAISE EXCEPTION 'Não é possível refazer: existem % parcela(s) já pagas ou parcialmente pagas para este contrato. Ajuste no financeiro antes.', paid_count;
  END IF;

  SELECT array_agg(id) INTO v_invoice_ids
  FROM public.invoices
  WHERE contract_id = _contract_id
    AND status <> 'written_off';

  -- Preserve history: archive old open installments/invoices instead of deleting,
  -- because installment_events keeps audit rows linked to installment ids.
  IF v_invoice_ids IS NOT NULL THEN
    UPDATE public.installments
       SET locked = false,
           status = 'written_off',
           updated_at = now()
     WHERE invoice_id = ANY(v_invoice_ids)
       AND status NOT IN ('paid', 'partial');

    UPDATE public.invoices
       SET locked = false,
           status = 'written_off',
           closed_at = COALESCE(closed_at, now()),
           updated_at = now()
     WHERE id = ANY(v_invoice_ids);
  END IF;

  -- Remove generated cash-flow entries for this contract. Some historical rows
  -- were created before source/source_id was filled, so match by contract_id too.
  PERFORM set_config('app.allow_financial_delete', 'true', true);

  DELETE FROM public.financial_entries
  WHERE entry_type = 'receivable'
    AND contract_id = _contract_id
    AND status NOT IN ('paid', 'partially_paid');

  -- Recreate cash-flow entries and the invoice/installment schedule from the
  -- current client_contracts.installments_detail.
  UPDATE public.client_contracts
  SET receivables_generated = false,
      receivables_generated_at = NULL,
      updated_at = now()
  WHERE id = _contract_id;

  UPDATE public.client_contracts
  SET receivables_generated = true,
      receivables_generated_at = now(),
      updated_at = now()
  WHERE id = _contract_id;

  SELECT count(*)::int INTO created_count
  FROM public.installments i
  JOIN public.invoices inv ON inv.id = i.invoice_id
  WHERE inv.contract_id = _contract_id
    AND inv.status <> 'written_off';

  RETURN created_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.regenerate_contract_receivables(uuid) TO authenticated, service_role;

SELECT public.regenerate_contract_receivables('60874364-2b15-4db7-9435-ad4b7ce1bb3a'::uuid);