-- Remover políticas antigas com erro
DROP POLICY IF EXISTS "Users can view their account tasks" ON marketing_tasks;
DROP POLICY IF EXISTS "Users can create tasks for their account" ON marketing_tasks;
DROP POLICY IF EXISTS "Users can update their account tasks" ON marketing_tasks;
DROP POLICY IF EXISTS "Users can delete their account tasks" ON marketing_tasks;

-- SELECT: Usuários veem tarefas da conta OU super admins/admins veem tudo
CREATE POLICY "Users can view their account tasks" 
ON marketing_tasks FOR SELECT
USING (
  account_id = get_my_account_id()
  OR is_super_admin()
  OR is_account_owner()
);

-- INSERT: Usuários criam na própria conta OU super admins/admins criam qualquer
CREATE POLICY "Users can create tasks for their account" 
ON marketing_tasks FOR INSERT
WITH CHECK (
  account_id = get_my_account_id()
  OR is_super_admin()
  OR is_account_owner()
);

-- UPDATE: Usuários atualizam na própria conta OU super admins/admins atualizam qualquer
CREATE POLICY "Users can update their account tasks" 
ON marketing_tasks FOR UPDATE
USING (
  account_id = get_my_account_id()
  OR is_super_admin()
  OR is_account_owner()
);

-- DELETE: Usuários deletam na própria conta OU super admins/admins deletam qualquer
CREATE POLICY "Users can delete their account tasks" 
ON marketing_tasks FOR DELETE
USING (
  account_id = get_my_account_id()
  OR is_super_admin()
  OR is_account_owner()
);