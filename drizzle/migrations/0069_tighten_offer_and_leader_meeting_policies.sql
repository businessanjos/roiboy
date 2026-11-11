DROP POLICY IF EXISTS "Public can respond to offer" ON public.hr_job_offers;
DROP POLICY IF EXISTS "Authenticated can insert leader meetings" ON public.leader_meetings;
DROP POLICY IF EXISTS "Authenticated can update leader meetings" ON public.leader_meetings;
DROP POLICY IF EXISTS "Authenticated can view leader meetings" ON public.leader_meetings;
CREATE POLICY "Account members view leader meetings" ON public.leader_meetings FOR SELECT TO authenticated USING (public.user_belongs_to_account(account_id));
CREATE POLICY "Account members insert leader meetings" ON public.leader_meetings FOR INSERT TO authenticated WITH CHECK (public.user_belongs_to_account(account_id));
CREATE POLICY "Account members update leader meetings" ON public.leader_meetings FOR UPDATE TO authenticated USING (public.user_belongs_to_account(account_id)) WITH CHECK (public.user_belongs_to_account(account_id));