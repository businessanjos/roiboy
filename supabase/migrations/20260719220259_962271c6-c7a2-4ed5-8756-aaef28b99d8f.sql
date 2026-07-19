
WITH mvp_contracts AS (
  SELECT cc.id FROM public.client_contracts cc
  JOIN public.products p ON p.id = cc.product_id
  WHERE p.name ILIKE '%MVP%'
),
ranked AS (
  SELECT fe.id,
    ROW_NUMBER() OVER (
      PARTITION BY 
        fe.contract_id, 
        to_char(fe.due_date, 'YYYY-MM'), 
        fe.amount
      ORDER BY
        (fe.payment_date IS NOT NULL) DESC,
        fe.is_conciliated DESC NULLS LAST,
        (fe.installment_number IS NOT NULL) DESC,
        fe.created_at ASC
    ) AS rn
  FROM public.financial_entries fe
  WHERE fe.entry_type = 'receivable'
    AND fe.contract_id IN (SELECT id FROM mvp_contracts)
)
DELETE FROM public.financial_entries fe
USING ranked r
WHERE fe.id = r.id
  AND r.rn > 1
  AND fe.payment_date IS NULL
  AND COALESCE(fe.is_conciliated, false) = false;
