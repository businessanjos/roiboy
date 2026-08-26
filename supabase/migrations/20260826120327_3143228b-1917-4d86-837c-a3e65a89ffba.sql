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
        'brualmeida.est@hotmail.com','arthur.mudri@hotmail.com'
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_hr_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_hr_user(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "HR can view applications from their account" ON public.hr_job_applications;
CREATE POLICY "HR can view applications from their account"
ON public.hr_job_applications FOR SELECT TO authenticated
USING (account_id = get_current_user_account_id() AND (is_account_owner() OR is_hr_user()));