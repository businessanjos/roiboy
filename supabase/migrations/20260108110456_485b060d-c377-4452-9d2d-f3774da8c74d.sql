-- =====================================================
-- Correção de Visibilidade do Playbook
-- =====================================================

-- 1. Criar/Atualizar função para obter o users.id do usuário atual
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1
$$;

-- 2. Remover policies conflitantes de playbook_items
DROP POLICY IF EXISTS "Users can view playbook_items in their account" ON playbook_items;
DROP POLICY IF EXISTS "Users can manage their account playbook items" ON playbook_items;
DROP POLICY IF EXISTS "Users can view playbook items" ON playbook_items;
DROP POLICY IF EXISTS "Users can update playbook_items in their account" ON playbook_items;
DROP POLICY IF EXISTS "Users can delete playbook_items in their account" ON playbook_items;
DROP POLICY IF EXISTS "Users can update playbook_items" ON playbook_items;
DROP POLICY IF EXISTS "Users can delete playbook_items" ON playbook_items;

-- 3. Remover policies conflitantes de playbook_folders
DROP POLICY IF EXISTS "Users can view playbook_folders in their account" ON playbook_folders;
DROP POLICY IF EXISTS "Users can manage their account playbook folders" ON playbook_folders;
DROP POLICY IF EXISTS "Users can view playbook folders" ON playbook_folders;
DROP POLICY IF EXISTS "Users can update playbook_folders in their account" ON playbook_folders;
DROP POLICY IF EXISTS "Users can delete playbook_folders in their account" ON playbook_folders;
DROP POLICY IF EXISTS "Users can update playbook_folders" ON playbook_folders;
DROP POLICY IF EXISTS "Users can delete playbook_folders" ON playbook_folders;

-- 4. Criar policies corretas para playbook_items

-- SELECT: Respeita visibilidade
CREATE POLICY "Users can view playbook items" ON playbook_items
FOR SELECT TO authenticated
USING (
  account_id = get_user_account_id()
  AND (
    visibility = 'sector'
    OR (visibility = 'personal' AND created_by = get_current_user_id())
  )
);

-- UPDATE: Apenas criador pode editar itens pessoais
CREATE POLICY "Users can update playbook_items" ON playbook_items
FOR UPDATE TO authenticated
USING (
  account_id = get_user_account_id()
  AND (
    visibility = 'sector'
    OR (visibility = 'personal' AND created_by = get_current_user_id())
  )
)
WITH CHECK (
  account_id = get_user_account_id()
);

-- DELETE: Apenas criador pode deletar itens pessoais
CREATE POLICY "Users can delete playbook_items" ON playbook_items
FOR DELETE TO authenticated
USING (
  account_id = get_user_account_id()
  AND (
    visibility = 'sector'
    OR (visibility = 'personal' AND created_by = get_current_user_id())
  )
);

-- 5. Criar policies corretas para playbook_folders

-- SELECT: Respeita visibilidade
CREATE POLICY "Users can view playbook folders" ON playbook_folders
FOR SELECT TO authenticated
USING (
  account_id = get_user_account_id()
  AND (
    visibility = 'sector'
    OR (visibility = 'personal' AND created_by = get_current_user_id())
  )
);

-- UPDATE: Apenas criador pode editar pastas pessoais
CREATE POLICY "Users can update playbook_folders" ON playbook_folders
FOR UPDATE TO authenticated
USING (
  account_id = get_user_account_id()
  AND (
    visibility = 'sector'
    OR (visibility = 'personal' AND created_by = get_current_user_id())
  )
)
WITH CHECK (
  account_id = get_user_account_id()
);

-- DELETE: Apenas criador pode deletar pastas pessoais
CREATE POLICY "Users can delete playbook_folders" ON playbook_folders
FOR DELETE TO authenticated
USING (
  account_id = get_user_account_id()
  AND (
    visibility = 'sector'
    OR (visibility = 'personal' AND created_by = get_current_user_id())
  )
);