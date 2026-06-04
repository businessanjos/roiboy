
-- 1. Fix broken ai_usage policies (use auth_user_id, not id)
DROP POLICY IF EXISTS "Admins can view usage alerts" ON public.ai_usage_alerts;
CREATE POLICY "Admins can view usage alerts" ON public.ai_usage_alerts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND u.account_id = ai_usage_alerts.account_id
      AND (u.role = 'admin'::user_role OR u.is_also_admin = true)
  ));

DROP POLICY IF EXISTS "Admins can manage usage limits" ON public.ai_usage_limits;
CREATE POLICY "Admins can manage usage limits" ON public.ai_usage_limits
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND u.account_id = ai_usage_limits.account_id
      AND (u.role = 'admin'::user_role OR u.is_also_admin = true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND u.account_id = ai_usage_limits.account_id
      AND (u.role = 'admin'::user_role OR u.is_also_admin = true)
  ));

-- 2. Restrict OAuth/secret token tables' SELECT to account owners/admins only.
-- Edge functions use service_role and bypass RLS, so backend reads keep working.

-- content_platform_accounts
DROP POLICY IF EXISTS cpa_select ON public.content_platform_accounts;
CREATE POLICY cpa_select ON public.content_platform_accounts
  FOR SELECT TO authenticated
  USING (
    account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
    AND is_account_owner()
  );

-- instagram_credentials
DROP POLICY IF EXISTS "Users can view their account instagram credentials" ON public.instagram_credentials;
DROP POLICY IF EXISTS "Users can view credentials of their profiles" ON public.instagram_credentials;
CREATE POLICY "Admins can view instagram credentials" ON public.instagram_credentials
  FOR SELECT TO authenticated
  USING (
    is_account_owner() AND profile_id IN (
      SELECT id FROM public.instagram_profiles
      WHERE account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
    )
  );

-- instagram_profiles: drop SELECT and recreate without exposing meta_access_token broadly.
-- Note: column-level grants are complex; restrict whole row SELECT to owners.
DROP POLICY IF EXISTS "Users can view their account instagram profiles" ON public.instagram_profiles;
CREATE POLICY "Admins can view instagram profiles" ON public.instagram_profiles
  FOR SELECT TO authenticated
  USING (
    is_account_owner()
    AND account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
  );

-- tiktok_credentials
DROP POLICY IF EXISTS "Users can view their account's TikTok credentials" ON public.tiktok_credentials;
CREATE POLICY "Admins can view tiktok credentials" ON public.tiktok_credentials
  FOR SELECT TO authenticated
  USING (
    is_account_owner()
    AND account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
  );

-- omie_settings
DROP POLICY IF EXISTS "Users can view own account omie_settings" ON public.omie_settings;
CREATE POLICY "Admins can view omie_settings" ON public.omie_settings
  FOR SELECT TO authenticated
  USING (is_account_owner() AND account_id = get_my_account_id());

-- contratadas: split SELECT into masked (all members) and full (admins).
-- Simpler: restrict SELECT to admins only. Other code paths that need basic data should use service_role or a view.
DROP POLICY IF EXISTS contratadas_select ON public.contratadas;
CREATE POLICY contratadas_select ON public.contratadas
  FOR SELECT TO authenticated
  USING (account_id = get_user_account_id() AND is_account_owner());

-- webhooks: split ALL into per-cmd; restrict SELECT/INSERT/UPDATE/DELETE to admins
DROP POLICY IF EXISTS "Users can manage webhooks of their account" ON public.webhooks;
CREATE POLICY "Admins can manage webhooks" ON public.webhooks
  FOR ALL TO authenticated
  USING (
    is_account_owner()
    AND account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    is_account_owner()
    AND account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
  );

-- 3. security_audit_logs: tighten INSERT to enforce caller identity / account
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.security_audit_logs;
DROP POLICY IF EXISTS "Users can insert their own security audit logs" ON public.security_audit_logs;
CREATE POLICY "Users insert own security audit logs" ON public.security_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (user_id IS NULL OR user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()))
    AND (account_id IS NULL OR account_id = get_user_account_id())
  );

-- 4. zapp_messages: restrict roles from public to authenticated
DROP POLICY IF EXISTS "Users can view zapp_messages from their account" ON public.zapp_messages;
DROP POLICY IF EXISTS "Users can insert zapp_messages to their account" ON public.zapp_messages;
DROP POLICY IF EXISTS "Users can update zapp_messages in their account" ON public.zapp_messages;
DROP POLICY IF EXISTS "Users can delete zapp_messages in their account" ON public.zapp_messages;

CREATE POLICY "Users can view zapp_messages from their account" ON public.zapp_messages
  FOR SELECT TO authenticated USING (account_id = get_user_account_id());
CREATE POLICY "Users can insert zapp_messages to their account" ON public.zapp_messages
  FOR INSERT TO authenticated WITH CHECK (account_id = get_user_account_id());
CREATE POLICY "Users can update zapp_messages in their account" ON public.zapp_messages
  FOR UPDATE TO authenticated USING (account_id = get_user_account_id());
CREATE POLICY "Users can delete zapp_messages in their account" ON public.zapp_messages
  FOR DELETE TO authenticated USING (account_id = get_user_account_id());

-- 5. hr_job_applications: restrict SELECT to account owners / HR managers only
DROP POLICY IF EXISTS "Users can view applications from their account" ON public.hr_job_applications;
CREATE POLICY "HR can view applications from their account" ON public.hr_job_applications
  FOR SELECT TO authenticated
  USING (account_id = get_current_user_account_id() AND is_account_owner());
