-- Função para DRE corrigida
CREATE OR REPLACE FUNCTION public.get_dre_report(
  p_account_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  category_type text,
  category_id uuid,
  category_name text,
  total_amount numeric,
  display_order integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    CASE 
      WHEN fe.entry_type = 'receivable' THEN 'revenue'
      ELSE COALESCE(fc.type, 'expense')
    END as category_type,
    fc.id as category_id,
    COALESCE(fc.name, 'Sem categoria') as category_name,
    SUM(fe.amount) as total_amount,
    COALESCE(fc.display_order, 999) as display_order
  FROM public.financial_entries fe
  LEFT JOIN public.financial_categories fc ON fc.id = fe.category_id
  WHERE fe.account_id = p_account_id
    AND fe.status = 'paid'
    AND fe.payment_date >= p_start_date
    AND fe.payment_date <= p_end_date
  GROUP BY fe.entry_type, fc.id, fc.name, fc.type, fc.display_order
  ORDER BY 
    CASE WHEN fe.entry_type = 'receivable' THEN 0 ELSE 1 END,
    COALESCE(fc.display_order, 999);
$$;