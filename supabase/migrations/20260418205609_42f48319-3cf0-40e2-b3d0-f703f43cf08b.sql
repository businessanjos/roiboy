DROP POLICY IF EXISTS "Users can view positions in their account" ON public.hr_positions;
DROP POLICY IF EXISTS "Users can create positions in their account" ON public.hr_positions;
DROP POLICY IF EXISTS "Users can update positions in their account" ON public.hr_positions;
DROP POLICY IF EXISTS "Users can delete positions in their account" ON public.hr_positions;

CREATE POLICY "Users can view positions in their account"
ON public.hr_positions FOR SELECT
USING (account_id = (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can create positions in their account"
ON public.hr_positions FOR INSERT
WITH CHECK (account_id = (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update positions in their account"
ON public.hr_positions FOR UPDATE
USING (account_id = (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete positions in their account"
ON public.hr_positions FOR DELETE
USING (account_id = (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));