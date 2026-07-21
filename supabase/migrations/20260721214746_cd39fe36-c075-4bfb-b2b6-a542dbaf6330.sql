
CREATE OR REPLACE VIEW public.financial_sync_issues AS
WITH pairs AS (
  SELECT i.id AS installment_id,
         i.account_id,
         i.invoice_id,
         inv.contract_id,
         inv.client_id,
         i.number AS installment_number,
         i.due_date,
         i.amount AS installment_amount,
         i.status AS installment_status,
         fe.id AS entry_id,
         fe.status AS entry_status,
         fe.amount AS entry_amount
  FROM installments i
  JOIN invoices inv ON inv.id = i.invoice_id
  LEFT JOIN financial_entries fe
    ON fe.source = 'contract'
   AND fe.source_id = inv.contract_id
   AND fe.installment_number = i.number
)
SELECT installment_id, account_id, invoice_id, contract_id, client_id,
       installment_number, due_date, installment_amount, installment_status,
       entry_id, entry_status, entry_amount,
       CASE
         WHEN entry_id IS NULL AND installment_status <> ALL (ARRAY['cancelled','renegotiated','written_off']) THEN 'missing_entry'
         WHEN installment_status = 'paid' AND entry_status <> ALL (ARRAY['paid','partially_paid']) THEN 'installment_paid_entry_open'
         WHEN entry_status = 'paid' AND installment_status <> ALL (ARRAY['paid','renegotiated','written_off']) THEN 'entry_paid_installment_open'
         WHEN installment_status = 'cancelled' AND entry_status <> ALL (ARRAY['cancelled','renegotiated']) THEN 'installment_cancelled_entry_active'
         WHEN entry_status = 'cancelled' AND installment_status <> ALL (ARRAY['cancelled','renegotiated','written_off']) THEN 'entry_cancelled_installment_active'
         WHEN installment_status = 'renegotiated' AND entry_status <> ALL (ARRAY['renegotiated','cancelled']) THEN 'installment_renegotiated_entry_active'
         WHEN entry_status = 'renegotiated' AND installment_status <> ALL (ARRAY['renegotiated','cancelled']) THEN 'entry_renegotiated_installment_active'
         WHEN entry_id IS NOT NULL
              AND round(installment_amount::numeric, 2) <> round(entry_amount, 2)
              AND installment_status <> ALL (ARRAY['cancelled','renegotiated','written_off']) THEN 'amount_mismatch'
         ELSE NULL
       END AS issue_type
FROM pairs;
