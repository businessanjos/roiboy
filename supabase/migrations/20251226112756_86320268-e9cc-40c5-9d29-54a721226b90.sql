-- =====================================================
-- CORREÇÃO DE SEGURANÇA: Restringir acesso a usuários autenticados
-- =====================================================

-- 1. ACCOUNTS - Remover policies existentes e criar novas restritas a authenticated
DROP POLICY IF EXISTS "Users can view their account" ON public.accounts;
DROP POLICY IF EXISTS "Users can update their account" ON public.accounts;
DROP POLICY IF EXISTS "Super admins can view all accounts" ON public.accounts;
DROP POLICY IF EXISTS "Super admins can update all accounts" ON public.accounts;
DROP POLICY IF EXISTS "Super admins can insert accounts" ON public.accounts;
DROP POLICY IF EXISTS "Super admins can delete accounts" ON public.accounts;

CREATE POLICY "Users can view their account" ON public.accounts
FOR SELECT TO authenticated
USING (id = get_user_account_id());

CREATE POLICY "Users can update their account" ON public.accounts
FOR UPDATE TO authenticated
USING (id = get_user_account_id())
WITH CHECK (id = get_user_account_id());

CREATE POLICY "Super admins can view all accounts" ON public.accounts
FOR SELECT TO authenticated
USING (is_super_admin());

CREATE POLICY "Super admins can update all accounts" ON public.accounts
FOR UPDATE TO authenticated
USING (is_super_admin());

CREATE POLICY "Super admins can insert accounts" ON public.accounts
FOR INSERT TO authenticated
WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can delete accounts" ON public.accounts
FOR DELETE TO authenticated
USING (is_super_admin());

-- 2. USERS - Remover policies existentes e criar novas restritas a authenticated
DROP POLICY IF EXISTS "Users can view users in their account" ON public.users;
DROP POLICY IF EXISTS "Users can view team members in their account" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Super admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Super admins can update all users" ON public.users;
DROP POLICY IF EXISTS "Super admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Super admins can delete users" ON public.users;

CREATE POLICY "Users can view users in their account" ON public.users
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can update their own profile" ON public.users
FOR UPDATE TO authenticated
USING (auth_user_id = auth.uid());

CREATE POLICY "Super admins can view all users" ON public.users
FOR SELECT TO authenticated
USING (is_super_admin());

CREATE POLICY "Super admins can update all users" ON public.users
FOR UPDATE TO authenticated
USING (is_super_admin());

CREATE POLICY "Super admins can insert users" ON public.users
FOR INSERT TO authenticated
WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can delete users" ON public.users
FOR DELETE TO authenticated
USING (is_super_admin());

-- 3. CLIENTS - Remover policies existentes e criar novas restritas a authenticated
DROP POLICY IF EXISTS "Users can view clients in their account" ON public.clients;
DROP POLICY IF EXISTS "Users can insert clients in their account" ON public.clients;
DROP POLICY IF EXISTS "Users can update clients in their account" ON public.clients;
DROP POLICY IF EXISTS "Users can delete clients in their account" ON public.clients;
DROP POLICY IF EXISTS "Super admins can view all clients" ON public.clients;

CREATE POLICY "Users can view clients in their account" ON public.clients
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert clients in their account" ON public.clients
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update clients in their account" ON public.clients
FOR UPDATE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete clients in their account" ON public.clients
FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Super admins can view all clients" ON public.clients
FOR SELECT TO authenticated
USING (is_super_admin());

-- 4. CLIENT_CONTRACTS
DROP POLICY IF EXISTS "Users can view contracts in their account" ON public.client_contracts;
DROP POLICY IF EXISTS "Users can insert contracts in their account" ON public.client_contracts;
DROP POLICY IF EXISTS "Users can update contracts in their account" ON public.client_contracts;
DROP POLICY IF EXISTS "Users can delete contracts in their account" ON public.client_contracts;

CREATE POLICY "Users can view contracts in their account" ON public.client_contracts
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert contracts in their account" ON public.client_contracts
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update contracts in their account" ON public.client_contracts
FOR UPDATE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete contracts in their account" ON public.client_contracts
FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

-- 5. CLIENT_SUBSCRIPTIONS
DROP POLICY IF EXISTS "Users can view subscriptions in their account" ON public.client_subscriptions;
DROP POLICY IF EXISTS "Users can insert subscriptions in their account" ON public.client_subscriptions;
DROP POLICY IF EXISTS "Users can update subscriptions in their account" ON public.client_subscriptions;
DROP POLICY IF EXISTS "Users can delete subscriptions in their account" ON public.client_subscriptions;

CREATE POLICY "Users can view subscriptions in their account" ON public.client_subscriptions
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert subscriptions in their account" ON public.client_subscriptions
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update subscriptions in their account" ON public.client_subscriptions
FOR UPDATE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete subscriptions in their account" ON public.client_subscriptions
FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

-- 6. SALES_RECORDS
DROP POLICY IF EXISTS "Users can view sales_records in their account" ON public.sales_records;
DROP POLICY IF EXISTS "Users can insert sales_records in their account" ON public.sales_records;
DROP POLICY IF EXISTS "Users can update sales_records in their account" ON public.sales_records;
DROP POLICY IF EXISTS "Users can delete sales_records in their account" ON public.sales_records;

CREATE POLICY "Users can view sales_records in their account" ON public.sales_records
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert sales_records in their account" ON public.sales_records
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update sales_records in their account" ON public.sales_records
FOR UPDATE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete sales_records in their account" ON public.sales_records
FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

-- 7. CLIENT_DIAGNOSTICS
DROP POLICY IF EXISTS "Users can view diagnostics in their account" ON public.client_diagnostics;
DROP POLICY IF EXISTS "Users can insert diagnostics in their account" ON public.client_diagnostics;
DROP POLICY IF EXISTS "Users can update diagnostics in their account" ON public.client_diagnostics;
DROP POLICY IF EXISTS "Users can delete diagnostics in their account" ON public.client_diagnostics;

CREATE POLICY "Users can view diagnostics in their account" ON public.client_diagnostics
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert diagnostics in their account" ON public.client_diagnostics
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update diagnostics in their account" ON public.client_diagnostics
FOR UPDATE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete diagnostics in their account" ON public.client_diagnostics
FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

-- 8. EVENT_FEEDBACK
DROP POLICY IF EXISTS "Users can view feedback in their account" ON public.event_feedback;
DROP POLICY IF EXISTS "Users can insert feedback in their account" ON public.event_feedback;
DROP POLICY IF EXISTS "Users can update feedback in their account" ON public.event_feedback;
DROP POLICY IF EXISTS "Users can delete feedback in their account" ON public.event_feedback;

CREATE POLICY "Users can view feedback in their account" ON public.event_feedback
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert feedback in their account" ON public.event_feedback
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update feedback in their account" ON public.event_feedback
FOR UPDATE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete feedback in their account" ON public.event_feedback
FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

-- 9. ROI_EVENTS
DROP POLICY IF EXISTS "Users can view roi_events in their account" ON public.roi_events;
DROP POLICY IF EXISTS "Users can insert roi_events in their account" ON public.roi_events;
DROP POLICY IF EXISTS "Users can update roi_events in their account" ON public.roi_events;
DROP POLICY IF EXISTS "Users can delete roi_events in their account" ON public.roi_events;

CREATE POLICY "Users can view roi_events in their account" ON public.roi_events
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert roi_events in their account" ON public.roi_events
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update roi_events in their account" ON public.roi_events
FOR UPDATE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete roi_events in their account" ON public.roi_events
FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

-- 10. RISK_EVENTS
DROP POLICY IF EXISTS "Users can view risk_events in their account" ON public.risk_events;
DROP POLICY IF EXISTS "Users can insert risk_events in their account" ON public.risk_events;
DROP POLICY IF EXISTS "Users can update risk_events in their account" ON public.risk_events;
DROP POLICY IF EXISTS "Users can delete risk_events in their account" ON public.risk_events;

CREATE POLICY "Users can view risk_events in their account" ON public.risk_events
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert risk_events in their account" ON public.risk_events
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update risk_events in their account" ON public.risk_events
FOR UPDATE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete risk_events in their account" ON public.risk_events
FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

-- 11. CLIENT_FOLLOWUPS
DROP POLICY IF EXISTS "Users can view followups in their account" ON public.client_followups;
DROP POLICY IF EXISTS "Users can insert followups in their account" ON public.client_followups;
DROP POLICY IF EXISTS "Users can update followups in their account" ON public.client_followups;
DROP POLICY IF EXISTS "Users can delete followups in their account" ON public.client_followups;

CREATE POLICY "Users can view followups in their account" ON public.client_followups
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert followups in their account" ON public.client_followups
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update followups in their account" ON public.client_followups
FOR UPDATE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete followups in their account" ON public.client_followups
FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

-- 12. INTERNAL_TASKS
DROP POLICY IF EXISTS "Users can view tasks in their account" ON public.internal_tasks;
DROP POLICY IF EXISTS "Users can insert tasks in their account" ON public.internal_tasks;
DROP POLICY IF EXISTS "Users can update tasks in their account" ON public.internal_tasks;
DROP POLICY IF EXISTS "Users can delete tasks in their account" ON public.internal_tasks;

CREATE POLICY "Users can view tasks in their account" ON public.internal_tasks
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert tasks in their account" ON public.internal_tasks
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update tasks in their account" ON public.internal_tasks
FOR UPDATE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete tasks in their account" ON public.internal_tasks
FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

-- 13. MESSAGE_EVENTS
DROP POLICY IF EXISTS "Users can view message_events in their account" ON public.message_events;
DROP POLICY IF EXISTS "Users can insert message_events in their account" ON public.message_events;

CREATE POLICY "Users can view message_events in their account" ON public.message_events
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert message_events in their account" ON public.message_events
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

-- 14. AI_USAGE_LOGS
DROP POLICY IF EXISTS "Users can view ai_usage_logs in their account" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "Users can insert ai_usage_logs in their account" ON public.ai_usage_logs;

CREATE POLICY "Users can view ai_usage_logs in their account" ON public.ai_usage_logs
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert ai_usage_logs in their account" ON public.ai_usage_logs
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

-- 15. ACCOUNT_SETTINGS
DROP POLICY IF EXISTS "Users can view their account settings" ON public.account_settings;
DROP POLICY IF EXISTS "Users can insert their account settings" ON public.account_settings;
DROP POLICY IF EXISTS "Users can update their account settings" ON public.account_settings;
DROP POLICY IF EXISTS "Super admins can view all account_settings" ON public.account_settings;
DROP POLICY IF EXISTS "Super admins can update account_settings" ON public.account_settings;
DROP POLICY IF EXISTS "Super admins can insert account_settings" ON public.account_settings;
DROP POLICY IF EXISTS "Super admins can delete account_settings" ON public.account_settings;

CREATE POLICY "Users can view their account settings" ON public.account_settings
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert their account settings" ON public.account_settings
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update their account settings" ON public.account_settings
FOR UPDATE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Super admins can view all account_settings" ON public.account_settings
FOR SELECT TO authenticated
USING (is_super_admin());

CREATE POLICY "Super admins can update account_settings" ON public.account_settings
FOR UPDATE TO authenticated
USING (is_super_admin());

CREATE POLICY "Super admins can insert account_settings" ON public.account_settings
FOR INSERT TO authenticated
WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can delete account_settings" ON public.account_settings
FOR DELETE TO authenticated
USING (is_super_admin());

-- 16. EVENTS
DROP POLICY IF EXISTS "Users can view events in their account" ON public.events;
DROP POLICY IF EXISTS "Users can insert events in their account" ON public.events;
DROP POLICY IF EXISTS "Users can update events in their account" ON public.events;
DROP POLICY IF EXISTS "Users can delete events in their account" ON public.events;

CREATE POLICY "Users can view events in their account" ON public.events
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert events in their account" ON public.events
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update events in their account" ON public.events
FOR UPDATE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete events in their account" ON public.events
FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

-- 17. EVENT_COSTS
DROP POLICY IF EXISTS "Users can view costs in their account" ON public.event_costs;
DROP POLICY IF EXISTS "Users can insert costs in their account" ON public.event_costs;
DROP POLICY IF EXISTS "Users can update costs in their account" ON public.event_costs;
DROP POLICY IF EXISTS "Users can delete costs in their account" ON public.event_costs;

CREATE POLICY "Users can view costs in their account" ON public.event_costs
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert costs in their account" ON public.event_costs
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update costs in their account" ON public.event_costs
FOR UPDATE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete costs in their account" ON public.event_costs
FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

-- 18. COUPONS
DROP POLICY IF EXISTS "Users can view coupons in their account" ON public.coupons;
DROP POLICY IF EXISTS "Users can insert coupons in their account" ON public.coupons;
DROP POLICY IF EXISTS "Users can update coupons in their account" ON public.coupons;
DROP POLICY IF EXISTS "Users can delete coupons in their account" ON public.coupons;

CREATE POLICY "Users can view coupons in their account" ON public.coupons
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert coupons in their account" ON public.coupons
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update coupons in their account" ON public.coupons
FOR UPDATE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete coupons in their account" ON public.coupons
FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

-- 19. FORM_RESPONSES - Manter INSERT público para formulários públicos, mas SELECT autenticado
DROP POLICY IF EXISTS "Users can view form_responses in their account" ON public.form_responses;
DROP POLICY IF EXISTS "Users can insert form_responses in their account" ON public.form_responses;
DROP POLICY IF EXISTS "Anyone can submit form responses" ON public.form_responses;

-- Permitir submissão pública de formulários (necessário para formulários públicos)
CREATE POLICY "Anyone can submit form responses" ON public.form_responses
FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.forms 
    WHERE id = form_id AND is_active = true
  )
);

CREATE POLICY "Users can view form_responses in their account" ON public.form_responses
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

-- 20. AUDIT_LOGS
DROP POLICY IF EXISTS "Users can view audit logs in their account" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can insert audit logs in their account" ON public.audit_logs;
DROP POLICY IF EXISTS "Super admins can view all audit logs" ON public.audit_logs;

CREATE POLICY "Users can view audit logs in their account" ON public.audit_logs
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert audit logs in their account" ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Super admins can view all audit logs" ON public.audit_logs
FOR SELECT TO authenticated
USING (is_super_admin());