
-- 1) hr_collaborator_audit_log: lock down INSERT
DROP POLICY IF EXISTS "System can insert audit logs" ON public.hr_collaborator_audit_log;

CREATE POLICY "Authenticated users insert audit for their account"
ON public.hr_collaborator_audit_log
FOR INSERT
TO authenticated
WITH CHECK (account_id = public.get_current_user_account_id());

CREATE POLICY "Service role can insert audit logs"
ON public.hr_collaborator_audit_log
FOR INSERT
TO service_role
WITH CHECK (true);

-- 2) hr_job_applications: scope anon insert to job's owning account
DROP POLICY IF EXISTS "Anyone can create applications (public form)" ON public.hr_job_applications;

CREATE POLICY "Anyone can create applications (public form)"
ON public.hr_job_applications
FOR INSERT
TO anon
WITH CHECK (
  account_id = (SELECT hj.account_id FROM public.hr_jobs hj WHERE hj.id = hr_job_applications.job_id)
);

-- 3) form_responses: anon insert must match form's account
DROP POLICY IF EXISTS "Submit responses to active forms only" ON public.form_responses;

CREATE POLICY "Submit responses to active forms only"
ON public.form_responses
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.forms
    WHERE forms.id = form_responses.form_id
      AND forms.is_active = true
      AND forms.account_id = form_responses.account_id
  )
);

-- 4) Fix wrong identity column (users.id -> users.auth_user_id)

-- ai_suggestion_feedback
DROP POLICY IF EXISTS "Users can insert feedback for their account" ON public.ai_suggestion_feedback;
DROP POLICY IF EXISTS "Users can view their account feedback" ON public.ai_suggestion_feedback;

CREATE POLICY "Users can insert feedback for their account"
ON public.ai_suggestion_feedback
FOR INSERT
TO authenticated
WITH CHECK (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()));

CREATE POLICY "Users can view their account feedback"
ON public.ai_suggestion_feedback
FOR SELECT
TO authenticated
USING (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()));

-- custom_field_folders
DROP POLICY IF EXISTS "Users can create folders in their account" ON public.custom_field_folders;
DROP POLICY IF EXISTS "Users can delete folders in their account" ON public.custom_field_folders;
DROP POLICY IF EXISTS "Users can update folders in their account" ON public.custom_field_folders;
DROP POLICY IF EXISTS "Users can view folders from their account" ON public.custom_field_folders;

CREATE POLICY "Users can create folders in their account"
ON public.custom_field_folders
FOR INSERT
TO authenticated
WITH CHECK (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()));

CREATE POLICY "Users can delete folders in their account"
ON public.custom_field_folders
FOR DELETE
TO authenticated
USING (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()));

CREATE POLICY "Users can update folders in their account"
ON public.custom_field_folders
FOR UPDATE
TO authenticated
USING (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()));

CREATE POLICY "Users can view folders from their account"
ON public.custom_field_folders
FOR SELECT
TO authenticated
USING (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()));

-- external_dashboard_access
DROP POLICY IF EXISTS "Account members can create external access" ON public.external_dashboard_access;
DROP POLICY IF EXISTS "Account members can delete external access" ON public.external_dashboard_access;
DROP POLICY IF EXISTS "Account members can update external access" ON public.external_dashboard_access;
DROP POLICY IF EXISTS "Account members can view external access" ON public.external_dashboard_access;

CREATE POLICY "Account members can create external access"
ON public.external_dashboard_access
FOR INSERT
TO authenticated
WITH CHECK (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()));

CREATE POLICY "Account members can delete external access"
ON public.external_dashboard_access
FOR DELETE
TO authenticated
USING (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()));

CREATE POLICY "Account members can update external access"
ON public.external_dashboard_access
FOR UPDATE
TO authenticated
USING (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()));

CREATE POLICY "Account members can view external access"
ON public.external_dashboard_access
FOR SELECT
TO authenticated
USING (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()));
