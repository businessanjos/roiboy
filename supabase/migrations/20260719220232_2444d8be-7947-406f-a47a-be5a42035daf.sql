
-- 1) Thassia: remove FE auto-geradas duplicadas (mantém as MVP marcadas como pagas)
DELETE FROM public.financial_entries
WHERE contract_id = 'aa7e8496-9593-4480-8b2f-cdc0162ba091'
  AND entry_type = 'receivable'
  AND description NOT LIKE '%Eternum MVP - Thassia%'
  AND payment_date IS NULL
  AND COALESCE(is_conciliated, false) = false;

-- 2) Dedupe global em contratos MVP
WITH mvp_contracts AS (
  SELECT cc.id FROM public.client_contracts cc
  JOIN public.products p ON p.id = cc.product_id
  WHERE p.name ILIKE '%MVP%'
),
ranked AS (
  SELECT fe.id,
    ROW_NUMBER() OVER (
      PARTITION BY fe.contract_id, fe.due_date, fe.amount
      ORDER BY
        (fe.payment_date IS NOT NULL) DESC,
        fe.is_conciliated DESC NULLS LAST,
        (fe.installment_number IS NOT NULL) DESC,
        fe.created_at DESC
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
