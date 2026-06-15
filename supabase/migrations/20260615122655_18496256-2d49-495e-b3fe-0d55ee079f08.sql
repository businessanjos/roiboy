DROP POLICY IF EXISTS "Admins can view instagram profiles" ON public.instagram_profiles;
CREATE POLICY "Users can view their account instagram profiles"
ON public.instagram_profiles
FOR SELECT
USING (account_id IN (SELECT users.account_id FROM public.users WHERE users.auth_user_id = auth.uid()));