DELETE FROM public.renewal_outcomes o
USING public.clients cl
WHERE o.client_id = cl.id
  AND cl.full_name = 'Gizelle Siqueira Guerra'
  AND o.outcome = 'renewed'
  AND o.resolved_at::date = CURRENT_DATE;