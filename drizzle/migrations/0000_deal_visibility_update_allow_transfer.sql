DROP POLICY IF EXISTS deal_visibility_update ON public.deals;
CREATE POLICY deal_visibility_update ON public.deals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (can_view_deal(status::text, responsible_user_id, sdr_user_id, renewal_responsible_user_id, created_by, pipeline_id))
  WITH CHECK (account_id = get_user_account_id());