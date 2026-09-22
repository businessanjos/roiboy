CREATE OR REPLACE FUNCTION public.is_hr_user(_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = COALESCE(_user_id, auth.uid())
      AND lower(u.email) IN (
        'm.quintana@me.com','coachevertonsantos@gmail.com','rh@anjosbusiness.com.br',
        'diessica@consultoria-luma.com','jaqueline@consultoria-luma.com',
        'brualmeida.est@hotmail.com','arthur.mudri@hotmail.com',
        'anjosgroup.dados@anjosbusiness.com','jessicamarcato@anjosbusiness.com'
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_hr_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_hr_user(uuid) TO authenticated, service_role;

INSERT INTO public.user_sector_access (user_id, account_id, sector_id, is_active)
SELECT 'c064c5d5-cdb5-47cc-99ce-ad416b6407b1'::uuid, u.account_id, 'rh', true
FROM public.users u
WHERE u.id = 'c064c5d5-cdb5-47cc-99ce-ad416b6407b1'::uuid
  AND NOT EXISTS (
  SELECT 1 FROM public.user_sector_access
  WHERE user_id = 'c064c5d5-cdb5-47cc-99ce-ad416b6407b1'::uuid AND sector_id = 'rh'
);

UPDATE public.user_sector_access
SET is_active = true
WHERE user_id = 'c064c5d5-cdb5-47cc-99ce-ad416b6407b1'::uuid AND sector_id = 'rh';