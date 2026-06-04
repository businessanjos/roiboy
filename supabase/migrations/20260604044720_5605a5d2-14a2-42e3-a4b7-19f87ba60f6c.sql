INSERT INTO public.user_sector_access (user_id, account_id, sector_id, role_in_sector, is_active)
SELECT o.user_id, o.account_id, 'eventos', o.role_in_sector, true
FROM public.user_sector_access o
WHERE o.sector_id = 'operacoes'
  AND o.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.user_sector_access e
    WHERE e.user_id = o.user_id AND e.sector_id = 'eventos'
  );