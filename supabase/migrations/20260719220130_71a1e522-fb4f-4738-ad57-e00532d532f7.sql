
SET LOCAL app.allow_financial_delete = 'true';

DO $$
DECLARE
  v_contract_id uuid := 'aa7e8496-9593-4480-8b2f-cdc0162ba091';
  v_inv_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_inv_ids FROM public.invoices WHERE contract_id = v_contract_id;

  IF v_inv_ids IS NOT NULL THEN
    UPDATE public.installments SET locked = false WHERE invoice_id = ANY(v_inv_ids);
    UPDATE public.installments SET status = 'written_off' WHERE invoice_id = ANY(v_inv_ids);
    UPDATE public.invoices SET locked = false WHERE id = ANY(v_inv_ids);
    UPDATE public.invoices SET status = 'written_off' WHERE id = ANY(v_inv_ids);
  END IF;

  DELETE FROM public.financial_entries
  WHERE contract_id = v_contract_id AND entry_type = 'receivable';

  UPDATE public.client_contracts SET receivables_generated = false WHERE id = v_contract_id;
  PERFORM public.generate_contract_installments(v_contract_id);
  UPDATE public.client_contracts SET receivables_generated = true WHERE id = v_contract_id;
END $$;

INSERT INTO public.financial_entries (
  account_id, entry_type, description, amount, due_date, payment_date,
  status, client_id, contract_id, installment_number, total_installments, category_id
)
SELECT
  inv.account_id, 'receivable',
  'Parcela ' || i.number || '/' || (SELECT count(*) FROM public.installments i2 WHERE i2.invoice_id = inv.id)
    || ' - Eternum MVP - Thassia Piezzaroli',
  i.amount, i.due_date, i.paid_at::date,
  CASE WHEN i.status = 'paid' THEN 'paid'
       WHEN i.due_date < CURRENT_DATE THEN 'overdue'
       ELSE 'pending' END,
  inv.client_id, inv.contract_id, i.number,
  (SELECT count(*) FROM public.installments i2 WHERE i2.invoice_id = inv.id),
  '0be6908b-78af-4bef-9179-8e33b25db3fb'::uuid
FROM public.installments i
JOIN public.invoices inv ON inv.id = i.invoice_id
WHERE inv.contract_id = 'aa7e8496-9593-4480-8b2f-cdc0162ba091'
  AND inv.status <> 'written_off';
