-- =====================================================
-- SECURITY FIX: Require authentication for all sensitive tables
-- This prevents anonymous access to PII and business data
-- =====================================================

-- INTEGRATIONS TABLE - Require auth (contains sensitive config)
DROP POLICY IF EXISTS "Users can view integrations in their account" ON public.integrations;
CREATE POLICY "Users can view integrations in their account" ON public.integrations
  FOR SELECT TO authenticated
  USING (account_id = get_user_account_id());

-- WHATSAPP_GROUPS TABLE - Require auth
DROP POLICY IF EXISTS "Users can view groups in their account" ON public.whatsapp_groups;
CREATE POLICY "Users can view groups in their account" ON public.whatsapp_groups
  FOR SELECT TO authenticated
  USING (account_id = get_user_account_id());

-- PRODUCTS TABLE - Require auth
DROP POLICY IF EXISTS "Users can view products in their account" ON public.products;
CREATE POLICY "Users can view products in their account" ON public.products
  FOR SELECT TO authenticated
  USING (account_id = get_user_account_id());

-- FORMS TABLE - Require auth for detailed view
DROP POLICY IF EXISTS "Users can view forms in their account" ON public.forms;
CREATE POLICY "Users can view forms in their account" ON public.forms
  FOR SELECT TO authenticated
  USING (account_id = get_user_account_id());

-- RECOMMENDATIONS TABLE - Require auth
DROP POLICY IF EXISTS "Users can view recommendations in their account" ON public.recommendations;
CREATE POLICY "Users can view recommendations in their account" ON public.recommendations
  FOR SELECT TO authenticated
  USING (account_id = get_user_account_id());

-- SUPPORT_TICKETS TABLE - Require auth or super admin
DROP POLICY IF EXISTS "Users can view support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can view their support tickets" ON public.support_tickets;
CREATE POLICY "Users can view their support tickets" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (
    account_id = get_user_account_id()
    OR is_super_admin()
  );

-- SUPPORT_MESSAGES TABLE - Require auth
DROP POLICY IF EXISTS "Users can view support messages" ON public.support_messages;
DROP POLICY IF EXISTS "Users can view their support messages" ON public.support_messages;
CREATE POLICY "Users can view their support messages" ON public.support_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets st
      WHERE st.id = ticket_id
      AND (st.account_id = get_user_account_id() OR is_super_admin())
    )
  );

-- USER_SESSIONS TABLE - Users can only see their own sessions
DROP POLICY IF EXISTS "Users can view their sessions" ON public.user_sessions;
CREATE POLICY "Users can view their sessions" ON public.user_sessions
  FOR SELECT TO authenticated
  USING (user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1));

-- LOGIN_ATTEMPTS TABLE - Only account owners should see this
DROP POLICY IF EXISTS "Admins can view login attempts" ON public.login_attempts;
DROP POLICY IF EXISTS "Account owners can view login attempts" ON public.login_attempts;
CREATE POLICY "Account owners can view login attempts" ON public.login_attempts
  FOR SELECT TO authenticated
  USING (is_account_owner());

-- VNPS_SNAPSHOTS TABLE - Require auth
DROP POLICY IF EXISTS "Users can view vnps in their account" ON public.vnps_snapshots;
CREATE POLICY "Users can view vnps in their account" ON public.vnps_snapshots
  FOR SELECT TO authenticated
  USING (account_id = get_user_account_id());

-- LIVE_SESSIONS TABLE - Require auth
DROP POLICY IF EXISTS "Users can view live sessions in their account" ON public.live_sessions;
CREATE POLICY "Users can view live sessions in their account" ON public.live_sessions
  FOR SELECT TO authenticated
  USING (account_id = get_user_account_id());

-- TEAM_ROLES TABLE - Require auth
DROP POLICY IF EXISTS "Users can view roles in their account" ON public.team_roles;
CREATE POLICY "Users can view roles in their account" ON public.team_roles
  FOR SELECT TO authenticated
  USING (account_id = get_user_account_id());

-- ROLE_PERMISSIONS TABLE - Require auth
DROP POLICY IF EXISTS "Users can view permissions in their account" ON public.role_permissions;
CREATE POLICY "Users can view permissions in their account" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_roles tr
      WHERE tr.id = role_id
      AND tr.account_id = get_user_account_id()
    )
  );

-- EVENT_SCHEDULE TABLE - Require auth
DROP POLICY IF EXISTS "Users can view schedule in their account" ON public.event_schedule;
CREATE POLICY "Users can view schedule in their account" ON public.event_schedule
  FOR SELECT TO authenticated
  USING (account_id = get_user_account_id());

-- EVENT_TEAM TABLE - Require auth
DROP POLICY IF EXISTS "Users can view event team in their account" ON public.event_team;
CREATE POLICY "Users can view event team in their account" ON public.event_team
  FOR SELECT TO authenticated
  USING (account_id = get_user_account_id());

-- EVENT_GIFTS TABLE - Require auth
DROP POLICY IF EXISTS "Users can view gifts in their account" ON public.event_gifts;
CREATE POLICY "Users can view gifts in their account" ON public.event_gifts
  FOR SELECT TO authenticated
  USING (account_id = get_user_account_id());

-- EVENT_NOTES TABLE - Require auth
DROP POLICY IF EXISTS "Users can view notes in their account" ON public.event_notes;
CREATE POLICY "Users can view notes in their account" ON public.event_notes
  FOR SELECT TO authenticated
  USING (account_id = get_user_account_id());

-- EVENT_MEDIA TABLE - Require auth
DROP POLICY IF EXISTS "Users can view media in their account" ON public.event_media;
CREATE POLICY "Users can view media in their account" ON public.event_media
  FOR SELECT TO authenticated
  USING (account_id = get_user_account_id());

-- REMINDER_CAMPAIGNS TABLE - Require auth
DROP POLICY IF EXISTS "Users can view campaigns in their account" ON public.reminder_campaigns;
CREATE POLICY "Users can view campaigns in their account" ON public.reminder_campaigns
  FOR SELECT TO authenticated
  USING (account_id = get_user_account_id());

-- REMINDER_RECIPIENTS TABLE - Require auth
DROP POLICY IF EXISTS "Users can view recipients in their account" ON public.reminder_recipients;
CREATE POLICY "Users can view recipients in their account" ON public.reminder_recipients
  FOR SELECT TO authenticated
  USING (account_id = get_user_account_id());

-- STAGE_CHECKLIST_ITEMS TABLE - Require auth
DROP POLICY IF EXISTS "Users can view checklist items in their account" ON public.stage_checklist_items;
CREATE POLICY "Users can view checklist items in their account" ON public.stage_checklist_items
  FOR SELECT TO authenticated
  USING (account_id = get_user_account_id());