-- =====================================================
-- MIGRAÇÃO DE SEGURANÇA RLS - ROY zAPP
-- Auditoria e reforço de políticas de acesso
-- =====================================================

-- FASE 1: CORREÇÕES CRÍTICAS
-- =====================================================

-- 1.1 - Restringir acesso à tabela ai_sector_agents (CRÍTICO)
-- Remover política pública que expõe configurações de IA
DROP POLICY IF EXISTS "Everyone can read AI sector agents" ON ai_sector_agents;

-- Criar política restritiva para usuários autenticados
CREATE POLICY "Users can view AI sector agents in their account"
ON ai_sector_agents FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.auth_user_id = auth.uid() 
    AND users.account_id IS NOT NULL
  )
);

-- 1.2 - Fortalecer form_responses INSERT (ALTA)
-- Remover políticas permissivas de INSERT
DROP POLICY IF EXISTS "Anyone can submit form responses" ON form_responses;
DROP POLICY IF EXISTS "Allow form submissions with valid form" ON form_responses;

-- Criar política com validação do formulário ativo
CREATE POLICY "Submit responses to active forms only"
ON form_responses FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM forms 
    WHERE forms.id = form_id 
    AND forms.is_active = true
  )
);

-- FASE 2: COMPLETAR COBERTURA DE POLÍTICAS
-- =====================================================

-- 2.1 - Adicionar DELETE às tabelas zAPP faltantes

-- zapp_conversations - adicionar DELETE
DROP POLICY IF EXISTS "Users can delete zapp_conversations in their account" ON zapp_conversations;
CREATE POLICY "Users can delete zapp_conversations in their account"
ON zapp_conversations FOR DELETE
TO authenticated
USING (account_id = get_user_account_id());

-- zapp_calls - adicionar DELETE
DROP POLICY IF EXISTS "Users can delete calls in their account" ON zapp_calls;
CREATE POLICY "Users can delete calls in their account"
ON zapp_calls FOR DELETE
TO authenticated
USING (account_id = get_user_account_id());

-- 2.2 - Proteger security_audit_logs INSERT
DROP POLICY IF EXISTS "Service can insert security audit logs" ON security_audit_logs;

CREATE POLICY "Authenticated users can insert audit logs"
ON security_audit_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- FASE 3: TABELAS DE SISTEMA/LOGS
-- =====================================================

-- 3.1 - Proteger system_settings (apenas super admins)
DROP POLICY IF EXISTS "Super admins can manage system settings" ON system_settings;
CREATE POLICY "Super admins can manage system settings"
ON system_settings FOR ALL
TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- 3.2 - Proteger rate_limit_logs
-- Inserção apenas via service role (backend)
DROP POLICY IF EXISTS "Service can insert rate limit logs" ON rate_limit_logs;
CREATE POLICY "Service can insert rate limit logs"
ON rate_limit_logs FOR INSERT
TO service_role
WITH CHECK (true);

-- Visualização para admins e owners
DROP POLICY IF EXISTS "Account owners can view rate limit logs" ON rate_limit_logs;
CREATE POLICY "Account owners can view rate limit logs"
ON rate_limit_logs FOR SELECT
TO authenticated
USING (is_account_owner() OR is_super_admin());

-- 3.3 - Completar políticas ai_analysis_queue
DROP POLICY IF EXISTS "Users can manage analysis queue in their account" ON ai_analysis_queue;
CREATE POLICY "Users can manage analysis queue in their account"
ON ai_analysis_queue FOR ALL
TO authenticated
USING (account_id = get_user_account_id())
WITH CHECK (account_id = get_user_account_id());