GRANT SELECT, INSERT, UPDATE ON TABLE public.renewal_outcomes TO authenticated;
GRANT ALL ON TABLE public.renewal_outcomes TO service_role;

DROP POLICY IF EXISTS "Users can update renewal outcomes in their account" ON public.renewal_outcomes;
CREATE POLICY "Users can update renewal outcomes in their account"
  ON public.renewal_outcomes
  FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT u.account_id
      FROM public.users u
      WHERE u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT u.account_id
      FROM public.users u
      WHERE u.auth_user_id = auth.uid()
    )
  );