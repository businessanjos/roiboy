DROP POLICY IF EXISTS "Users can view churn reports for their account" ON public.churn_analysis_reports;
DROP POLICY IF EXISTS "Users can insert churn reports for their account" ON public.churn_analysis_reports;

CREATE POLICY "Users can view churn reports for their account"
ON public.churn_analysis_reports
FOR SELECT
TO authenticated
USING (public.user_belongs_to_account(account_id));

CREATE POLICY "Users can insert churn reports for their account"
ON public.churn_analysis_reports
FOR INSERT
TO authenticated
WITH CHECK (public.user_belongs_to_account(account_id));