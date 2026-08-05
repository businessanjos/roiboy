DROP POLICY IF EXISTS require_vendas_sector_access ON public.deal_operation_briefings;

CREATE POLICY require_sales_or_ops_sector_access
ON public.deal_operation_briefings
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  public.user_has_sector_access(auth.uid(), 'vendas')
  OR public.user_has_sector_access(auth.uid(), 'sdr')
  OR public.user_has_sector_access(auth.uid(), 'operacoes')
)
WITH CHECK (
  public.user_has_sector_access(auth.uid(), 'vendas')
  OR public.user_has_sector_access(auth.uid(), 'sdr')
  OR public.user_has_sector_access(auth.uid(), 'operacoes')
);