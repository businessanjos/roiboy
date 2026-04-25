UPDATE public.user_sector_access usa
SET is_active = false,
    updated_at = now()
FROM public.users u
WHERE usa.user_id = u.id
  AND u.email = 'darlanferreira@anjosbusiness.com'
  AND usa.sector_id = 'configuracoes'
  AND usa.is_active = true;

UPDATE public.users
SET force_relogin_at = now()
WHERE email = 'darlanferreira@anjosbusiness.com';