
-- Fix 1: Replace broken `users.id = auth.uid()` with `users.auth_user_id = auth.uid()`

DROP POLICY IF EXISTS "Users can manage their account patterns" ON public.ai_effective_patterns;
DROP POLICY IF EXISTS "Users can view their account patterns" ON public.ai_effective_patterns;
CREATE POLICY "Users can manage their account patterns" ON public.ai_effective_patterns
  FOR ALL TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users can view their account patterns" ON public.ai_effective_patterns
  FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete their account emails" ON public.email_queue;
DROP POLICY IF EXISTS "Users can insert emails for their account" ON public.email_queue;
DROP POLICY IF EXISTS "Users can update their account emails" ON public.email_queue;
DROP POLICY IF EXISTS "Users can view their account emails" ON public.email_queue;
CREATE POLICY "Users can delete their account emails" ON public.email_queue
  FOR DELETE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users can insert emails for their account" ON public.email_queue
  FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users can update their account emails" ON public.email_queue
  FOR UPDATE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users can view their account emails" ON public.email_queue
  FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete credentials of their profiles" ON public.instagram_credentials;
DROP POLICY IF EXISTS "Users can insert credentials for their profiles" ON public.instagram_credentials;
DROP POLICY IF EXISTS "Users can update credentials of their profiles" ON public.instagram_credentials;
DROP POLICY IF EXISTS "Users can view credentials of their profiles" ON public.instagram_credentials;
CREATE POLICY "Users can delete credentials of their profiles" ON public.instagram_credentials
  FOR DELETE TO authenticated
  USING (profile_id IN (SELECT id FROM public.instagram_profiles WHERE account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())));
CREATE POLICY "Users can insert credentials for their profiles" ON public.instagram_credentials
  FOR INSERT TO authenticated
  WITH CHECK (profile_id IN (SELECT id FROM public.instagram_profiles WHERE account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())));
CREATE POLICY "Users can update credentials of their profiles" ON public.instagram_credentials
  FOR UPDATE TO authenticated
  USING (profile_id IN (SELECT id FROM public.instagram_profiles WHERE account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())));
CREATE POLICY "Users can view credentials of their profiles" ON public.instagram_credentials
  FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM public.instagram_profiles WHERE account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())));

DROP POLICY IF EXISTS "Users can create lead timeline events" ON public.lead_timeline;
DROP POLICY IF EXISTS "Users can delete lead timeline events" ON public.lead_timeline;
DROP POLICY IF EXISTS "Users can update lead timeline events" ON public.lead_timeline;
DROP POLICY IF EXISTS "Users can view lead timeline from their account" ON public.lead_timeline;
CREATE POLICY "Users can create lead timeline events" ON public.lead_timeline
  FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users can delete lead timeline events" ON public.lead_timeline
  FOR DELETE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users can update lead timeline events" ON public.lead_timeline
  FOR UPDATE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users can view lead timeline from their account" ON public.lead_timeline
  FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can create filters" ON public.pipeline_filters;
DROP POLICY IF EXISTS "Users can delete own filters" ON public.pipeline_filters;
DROP POLICY IF EXISTS "Users can update own filters" ON public.pipeline_filters;
DROP POLICY IF EXISTS "Users can view own and public filters" ON public.pipeline_filters;
CREATE POLICY "Users can create filters" ON public.pipeline_filters
  FOR INSERT TO authenticated
  WITH CHECK (
    account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
    AND created_by IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  );
CREATE POLICY "Users can delete own filters" ON public.pipeline_filters
  FOR DELETE TO authenticated
  USING (created_by IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users can update own filters" ON public.pipeline_filters
  FOR UPDATE TO authenticated
  USING (created_by IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()))
  WITH CHECK (created_by IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users can view own and public filters" ON public.pipeline_filters
  FOR SELECT TO authenticated
  USING (
    account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
    AND (created_by IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) OR is_public = true)
  );

-- Fix 2: hr_departments — restrict to authenticated role
DROP POLICY IF EXISTS "Users can delete hr_departments in their account" ON public.hr_departments;
DROP POLICY IF EXISTS "Users can insert hr_departments in their account" ON public.hr_departments;
DROP POLICY IF EXISTS "Users can update hr_departments in their account" ON public.hr_departments;
DROP POLICY IF EXISTS "Users can view hr_departments of their account" ON public.hr_departments;
CREATE POLICY "Users can delete hr_departments in their account" ON public.hr_departments
  FOR DELETE TO authenticated USING (account_id = get_my_account_id());
CREATE POLICY "Users can insert hr_departments in their account" ON public.hr_departments
  FOR INSERT TO authenticated WITH CHECK (account_id = get_my_account_id());
CREATE POLICY "Users can update hr_departments in their account" ON public.hr_departments
  FOR UPDATE TO authenticated USING (account_id = get_my_account_id());
CREATE POLICY "Users can view hr_departments of their account" ON public.hr_departments
  FOR SELECT TO authenticated USING (account_id = get_my_account_id());

-- Fix 3: client_churn_analyses — add account_id + restrict
ALTER TABLE public.client_churn_analyses ADD COLUMN IF NOT EXISTS account_id uuid;
UPDATE public.client_churn_analyses cca
  SET account_id = c.account_id
  FROM public.clients c
  WHERE cca.client_id = c.id AND cca.account_id IS NULL;
UPDATE public.client_churn_analyses cca
  SET account_id = u.account_id
  FROM public.users u
  WHERE cca.created_by = u.id AND cca.account_id IS NULL;

DROP POLICY IF EXISTS "Authenticated users can insert churn analyses" ON public.client_churn_analyses;
DROP POLICY IF EXISTS "Authenticated users can view churn analyses" ON public.client_churn_analyses;
CREATE POLICY "Users can view churn analyses in their account" ON public.client_churn_analyses
  FOR SELECT TO authenticated
  USING (account_id = get_user_account_id());
CREATE POLICY "Users can insert churn analyses in their account" ON public.client_churn_analyses
  FOR INSERT TO authenticated
  WITH CHECK (account_id = get_user_account_id());

-- Fix 4: ops_workload_ai_reports
ALTER TABLE public.ops_workload_ai_reports ADD COLUMN IF NOT EXISTS account_id uuid;
UPDATE public.ops_workload_ai_reports r
  SET account_id = u.account_id
  FROM public.users u
  WHERE r.created_by = u.id AND r.account_id IS NULL;

DROP POLICY IF EXISTS "Authenticated users can view ops workload reports" ON public.ops_workload_ai_reports;
DROP POLICY IF EXISTS "Authenticated users can insert ops workload reports" ON public.ops_workload_ai_reports;
DROP POLICY IF EXISTS "Authenticated can view ops_workload_ai_reports" ON public.ops_workload_ai_reports;
DROP POLICY IF EXISTS "Authenticated can insert ops_workload_ai_reports" ON public.ops_workload_ai_reports;
CREATE POLICY "Users can view ops reports in their account" ON public.ops_workload_ai_reports
  FOR SELECT TO authenticated
  USING (account_id = get_user_account_id());
CREATE POLICY "Users can insert ops reports in their account" ON public.ops_workload_ai_reports
  FOR INSERT TO authenticated
  WITH CHECK (account_id = get_user_account_id());

-- Fix 5: users — prevent self role escalation
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (
    auth_user_id = auth.uid()
    AND role = (SELECT u2.role FROM public.users u2 WHERE u2.auth_user_id = auth.uid())
    AND is_also_admin IS NOT DISTINCT FROM (SELECT u2.is_also_admin FROM public.users u2 WHERE u2.auth_user_id = auth.uid())
    AND account_id = (SELECT u2.account_id FROM public.users u2 WHERE u2.auth_user_id = auth.uid())
  );

-- Fix 6: can_access_consultant_bonus — replace hardcoded emails
CREATE OR REPLACE FUNCTION public.can_access_consultant_bonus()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND (u.role = 'admin' OR u.is_also_admin = true)
  );
$function$;
