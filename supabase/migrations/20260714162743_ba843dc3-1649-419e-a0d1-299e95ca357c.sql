
CREATE OR REPLACE FUNCTION public.regenerate_contract_receivables(_contract_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  deleted_paid int;
  created_count int;
BEGIN
  SELECT * INTO c FROM public.client_contracts WHERE id = _contract_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato não encontrado';
  END IF;

  -- Safety: don't destroy paid installments. If any exist, abort so the user
  -- goes to the financial module and reconciles manually.
  SELECT count(*) INTO deleted_paid
  FROM public.financial_entries
  WHERE source = 'contract'
    AND source_id = _contract_id
    AND status IN ('paid', 'partial');

  IF deleted_paid > 0 THEN
    RAISE EXCEPTION 'Não é possível refazer: existem % parcela(s) já pagas ou parcialmente pagas para este contrato. Ajuste no financeiro antes.', deleted_paid;
  END IF;

  -- Delete only pending/open entries (and their installments/invoices via cascade if configured)
  DELETE FROM public.financial_entries
  WHERE source = 'contract'
    AND source_id = _contract_id;

  -- Reset the flag and re-flip it so the DB trigger regenerates
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
  FROM public.financial_entries
  WHERE source = 'contract' AND source_id = _contract_id;

  RETURN created_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.regenerate_contract_receivables(uuid) TO authenticated;
