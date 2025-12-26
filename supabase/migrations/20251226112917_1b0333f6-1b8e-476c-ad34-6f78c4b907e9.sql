-- =====================================================
-- CORREÇÃO DE SEGURANÇA PARTE 2: Tabelas restantes
-- =====================================================

-- 21. PRODUCTS
DROP POLICY IF EXISTS "Users can view products in their account" ON public.products;
DROP POLICY IF EXISTS "Users can insert products in their account" ON public.products;
DROP POLICY IF EXISTS "Users can update products in their account" ON public.products;
DROP POLICY IF EXISTS "Users can delete products in their account" ON public.products;

CREATE POLICY "Users can view products in their account" ON public.products
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert products in their account" ON public.products
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update products in their account" ON public.products
FOR UPDATE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete products in their account" ON public.products
FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

-- 22. FORMS
DROP POLICY IF EXISTS "Users can view forms in their account" ON public.forms;
DROP POLICY IF EXISTS "Users can insert forms in their account" ON public.forms;
DROP POLICY IF EXISTS "Users can update forms in their account" ON public.forms;
DROP POLICY IF EXISTS "Users can delete forms in their account" ON public.forms;

CREATE POLICY "Users can view forms in their account" ON public.forms
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert forms in their account" ON public.forms
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update forms in their account" ON public.forms
FOR UPDATE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete forms in their account" ON public.forms
FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

-- 23. NOTIFICATIONS
DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert notifications in their account" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their notifications" ON public.notifications;

CREATE POLICY "Users can view their notifications" ON public.notifications
FOR SELECT TO authenticated
USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert notifications in their account" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update their notifications" ON public.notifications
FOR UPDATE TO authenticated
USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete their notifications" ON public.notifications
FOR DELETE TO authenticated
USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

-- 24. INTEGRATIONS
DROP POLICY IF EXISTS "Users can view integrations in their account" ON public.integrations;
DROP POLICY IF EXISTS "Users can insert integrations in their account" ON public.integrations;
DROP POLICY IF EXISTS "Users can update integrations in their account" ON public.integrations;
DROP POLICY IF EXISTS "Users can delete integrations in their account" ON public.integrations;

CREATE POLICY "Users can view integrations in their account" ON public.integrations
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert integrations in their account" ON public.integrations
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update integrations in their account" ON public.integrations
FOR UPDATE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete integrations in their account" ON public.integrations
FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

-- 25. USER_SESSIONS
DROP POLICY IF EXISTS "Users can view their sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can insert their sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can update their sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can delete their sessions" ON public.user_sessions;

CREATE POLICY "Users can view their sessions" ON public.user_sessions
FOR SELECT TO authenticated
USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert their sessions" ON public.user_sessions
FOR INSERT TO authenticated
WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update their sessions" ON public.user_sessions
FOR UPDATE TO authenticated
USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete their sessions" ON public.user_sessions
FOR DELETE TO authenticated
USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

-- 26. WHATSAPP_GROUPS - renomeando de whatsapp_integrations se existir
DROP POLICY IF EXISTS "Users can view whatsapp_groups in their account" ON public.whatsapp_groups;
DROP POLICY IF EXISTS "Users can insert whatsapp_groups in their account" ON public.whatsapp_groups;
DROP POLICY IF EXISTS "Users can update whatsapp_groups in their account" ON public.whatsapp_groups;
DROP POLICY IF EXISTS "Users can delete whatsapp_groups in their account" ON public.whatsapp_groups;

CREATE POLICY "Users can view whatsapp_groups in their account" ON public.whatsapp_groups
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert whatsapp_groups in their account" ON public.whatsapp_groups
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update whatsapp_groups in their account" ON public.whatsapp_groups
FOR UPDATE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete whatsapp_groups in their account" ON public.whatsapp_groups
FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

-- 27. CLIENT_LIFE_EVENTS
DROP POLICY IF EXISTS "Users can view life events in their account" ON public.client_life_events;
DROP POLICY IF EXISTS "Users can insert life events in their account" ON public.client_life_events;
DROP POLICY IF EXISTS "Users can update life events in their account" ON public.client_life_events;
DROP POLICY IF EXISTS "Users can delete life events in their account" ON public.client_life_events;

CREATE POLICY "Users can view life events in their account" ON public.client_life_events
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert life events in their account" ON public.client_life_events
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update life events in their account" ON public.client_life_events
FOR UPDATE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete life events in their account" ON public.client_life_events
FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

-- 28. RECOMMENDATIONS
DROP POLICY IF EXISTS "Users can view recommendations in their account" ON public.recommendations;
DROP POLICY IF EXISTS "Users can insert recommendations in their account" ON public.recommendations;
DROP POLICY IF EXISTS "Users can update recommendations in their account" ON public.recommendations;
DROP POLICY IF EXISTS "Users can delete recommendations in their account" ON public.recommendations;

CREATE POLICY "Users can view recommendations in their account" ON public.recommendations
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert recommendations in their account" ON public.recommendations
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update recommendations in their account" ON public.recommendations
FOR UPDATE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete recommendations in their account" ON public.recommendations
FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

-- 29. CLIENT_PRODUCTS
DROP POLICY IF EXISTS "Users can view client_products in their account" ON public.client_products;
DROP POLICY IF EXISTS "Users can insert client_products in their account" ON public.client_products;
DROP POLICY IF EXISTS "Users can delete client_products in their account" ON public.client_products;

CREATE POLICY "Users can view client_products in their account" ON public.client_products
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert client_products in their account" ON public.client_products
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can delete client_products in their account" ON public.client_products
FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

-- 30. CLIENT_STAGES
DROP POLICY IF EXISTS "Users can view stages in their account" ON public.client_stages;
DROP POLICY IF EXISTS "Users can insert stages in their account" ON public.client_stages;
DROP POLICY IF EXISTS "Users can update stages in their account" ON public.client_stages;
DROP POLICY IF EXISTS "Users can delete stages in their account" ON public.client_stages;

CREATE POLICY "Users can view stages in their account" ON public.client_stages
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert stages in their account" ON public.client_stages
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update stages in their account" ON public.client_stages
FOR UPDATE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete stages in their account" ON public.client_stages
FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

-- 31. CUSTOM_FIELDS
DROP POLICY IF EXISTS "Users can view custom fields in their account" ON public.custom_fields;
DROP POLICY IF EXISTS "Users can insert custom fields in their account" ON public.custom_fields;
DROP POLICY IF EXISTS "Users can update custom fields in their account" ON public.custom_fields;
DROP POLICY IF EXISTS "Users can delete custom fields in their account" ON public.custom_fields;

CREATE POLICY "Users can view custom fields in their account" ON public.custom_fields
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert custom fields in their account" ON public.custom_fields
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update custom fields in their account" ON public.custom_fields
FOR UPDATE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete custom fields in their account" ON public.custom_fields
FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

-- 32. CLIENT_FIELD_VALUES
DROP POLICY IF EXISTS "Users can view client field values in their account" ON public.client_field_values;
DROP POLICY IF EXISTS "Users can insert client field values in their account" ON public.client_field_values;
DROP POLICY IF EXISTS "Users can update client field values in their account" ON public.client_field_values;
DROP POLICY IF EXISTS "Users can delete client field values in their account" ON public.client_field_values;

CREATE POLICY "Users can view client field values in their account" ON public.client_field_values
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert client field values in their account" ON public.client_field_values
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update client field values in their account" ON public.client_field_values
FOR UPDATE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete client field values in their account" ON public.client_field_values
FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

-- 33. TEAM_ROLES
DROP POLICY IF EXISTS "Users can view team_roles in their account" ON public.team_roles;
DROP POLICY IF EXISTS "Users can insert team_roles in their account" ON public.team_roles;
DROP POLICY IF EXISTS "Users can update team_roles in their account" ON public.team_roles;
DROP POLICY IF EXISTS "Users can delete team_roles in their account" ON public.team_roles;

CREATE POLICY "Users can view team_roles in their account" ON public.team_roles
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert team_roles in their account" ON public.team_roles
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update team_roles in their account" ON public.team_roles
FOR UPDATE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete team_roles in their account" ON public.team_roles
FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

-- 34. ROLE_PERMISSIONS
DROP POLICY IF EXISTS "Users can view role_permissions in their account" ON public.role_permissions;
DROP POLICY IF EXISTS "Users can insert role_permissions in their account" ON public.role_permissions;
DROP POLICY IF EXISTS "Users can delete role_permissions in their account" ON public.role_permissions;

CREATE POLICY "Users can view role_permissions in their account" ON public.role_permissions
FOR SELECT TO authenticated
USING (
  role_id IN (
    SELECT id FROM public.team_roles WHERE account_id = get_user_account_id()
  )
);

CREATE POLICY "Users can insert role_permissions in their account" ON public.role_permissions
FOR INSERT TO authenticated
WITH CHECK (
  role_id IN (
    SELECT id FROM public.team_roles WHERE account_id = get_user_account_id()
  )
);

CREATE POLICY "Users can delete role_permissions in their account" ON public.role_permissions
FOR DELETE TO authenticated
USING (
  role_id IN (
    SELECT id FROM public.team_roles WHERE account_id = get_user_account_id()
  )
);

-- 35. REMINDERS
DROP POLICY IF EXISTS "Users can view reminders in their account" ON public.reminders;
DROP POLICY IF EXISTS "Users can insert reminders in their account" ON public.reminders;
DROP POLICY IF EXISTS "Users can update reminders in their account" ON public.reminders;
DROP POLICY IF EXISTS "Users can delete reminders in their account" ON public.reminders;

CREATE POLICY "Users can view reminders in their account" ON public.reminders
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert reminders in their account" ON public.reminders
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update reminders in their account" ON public.reminders
FOR UPDATE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete reminders in their account" ON public.reminders
FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

-- 36. ATTENDANCE (já tem policy, mas vamos garantir que é para authenticated)
DROP POLICY IF EXISTS "Users can view attendance in their account" ON public.attendance;
DROP POLICY IF EXISTS "Users can insert attendance in their account" ON public.attendance;
DROP POLICY IF EXISTS "Allow public event check-in via service role" ON public.attendance;

CREATE POLICY "Users can view attendance in their account" ON public.attendance
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert attendance in their account" ON public.attendance
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

-- 37. CONVERSATIONS
DROP POLICY IF EXISTS "Users can view conversations in their account" ON public.conversations;
DROP POLICY IF EXISTS "Users can insert conversations in their account" ON public.conversations;

CREATE POLICY "Users can view conversations in their account" ON public.conversations
FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert conversations in their account" ON public.conversations
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

-- 38. LOGIN_ATTEMPTS - Deve ser acessível para validação de segurança mas não publicamente
DROP POLICY IF EXISTS "Service role can manage login_attempts" ON public.login_attempts;

-- Login attempts são gerenciados via functions security definer, não precisam de policies para users comuns

-- 39. Habilitar proteção de senha vazada
-- Isso precisa ser feito via configuração do auth, não via SQL