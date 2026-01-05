-- Remove old policies
DROP POLICY IF EXISTS "Users can view marketing events from their account" ON public.marketing_events;
DROP POLICY IF EXISTS "Users can create marketing events for their account" ON public.marketing_events;
DROP POLICY IF EXISTS "Users can update marketing events from their account" ON public.marketing_events;
DROP POLICY IF EXISTS "Users can delete marketing events from their account" ON public.marketing_events;

-- Create corrected policies using get_my_account_id()
CREATE POLICY "Users can view marketing events from their account"
  ON public.marketing_events FOR SELECT
  USING (account_id = public.get_my_account_id());

CREATE POLICY "Users can create marketing events for their account"
  ON public.marketing_events FOR INSERT
  WITH CHECK (account_id = public.get_my_account_id());

CREATE POLICY "Users can update marketing events from their account"
  ON public.marketing_events FOR UPDATE
  USING (account_id = public.get_my_account_id());

CREATE POLICY "Users can delete marketing events from their account"
  ON public.marketing_events FOR DELETE
  USING (account_id = public.get_my_account_id());