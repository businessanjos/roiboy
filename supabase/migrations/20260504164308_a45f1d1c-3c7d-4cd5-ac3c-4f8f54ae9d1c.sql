
-- Security definer: verdadeiro apenas para os 4 e-mails autorizados
CREATE OR REPLACE FUNCTION public.can_access_consultant_bonus()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND lower(u.email) IN (
        'm.quintana@me.com',
        'jonathanmarcato@anjosbusiness.com',
        'coachevertonsantos@gmail.com',
        'brualmeida.est@hotmail.com'
      )
  );
$$;

-- ===== consultant_goals =====
DROP POLICY IF EXISTS "Users can view consultant_goals in their account" ON public.consultant_goals;
DROP POLICY IF EXISTS "Users can manage consultant_goals in their account" ON public.consultant_goals;

CREATE POLICY "Bonus admins can view consultant_goals"
  ON public.consultant_goals FOR SELECT
  TO authenticated
  USING (
    account_id = public.get_current_user_account_id()
    AND public.can_access_consultant_bonus()
  );

CREATE POLICY "Bonus admins can manage consultant_goals"
  ON public.consultant_goals FOR ALL
  TO authenticated
  USING (
    account_id = public.get_current_user_account_id()
    AND public.can_access_consultant_bonus()
  )
  WITH CHECK (
    account_id = public.get_current_user_account_id()
    AND public.can_access_consultant_bonus()
  );

-- ===== consultant_bonus_payouts =====
DROP POLICY IF EXISTS "Users can view payouts in their account" ON public.consultant_bonus_payouts;
DROP POLICY IF EXISTS "Users can manage payouts in their account" ON public.consultant_bonus_payouts;

CREATE POLICY "Bonus admins can view payouts"
  ON public.consultant_bonus_payouts FOR SELECT
  TO authenticated
  USING (
    account_id = public.get_current_user_account_id()
    AND public.can_access_consultant_bonus()
  );

CREATE POLICY "Bonus admins can manage payouts"
  ON public.consultant_bonus_payouts FOR ALL
  TO authenticated
  USING (
    account_id = public.get_current_user_account_id()
    AND public.can_access_consultant_bonus()
  )
  WITH CHECK (
    account_id = public.get_current_user_account_id()
    AND public.can_access_consultant_bonus()
  );
