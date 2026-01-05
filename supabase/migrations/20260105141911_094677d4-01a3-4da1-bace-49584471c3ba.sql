-- 1. Função get_my_account_id que bypassa RLS completamente
CREATE OR REPLACE FUNCTION public.get_my_account_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_account_id uuid;
  v_auth_uid uuid;
BEGIN
  v_auth_uid := auth.uid();
  
  IF v_auth_uid IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT account_id INTO v_account_id 
  FROM public.users 
  WHERE auth_user_id = v_auth_uid 
  LIMIT 1;
  
  RETURN v_account_id;
END;
$$;

-- 2. Função get_current_user_id que bypassa RLS
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_auth_uid uuid;
BEGIN
  v_auth_uid := auth.uid();
  
  IF v_auth_uid IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT id INTO v_user_id 
  FROM public.users 
  WHERE auth_user_id = v_auth_uid 
  LIMIT 1;
  
  RETURN v_user_id;
END;
$$;

-- 3. CRÍTICO: Alterar política de users para NÃO usar get_my_account_id
DROP POLICY IF EXISTS "Users can view teammates in same account" ON public.users;

-- Nova política que usa subquery direta (não chama função recursiva)
CREATE POLICY "Users can view teammates in same account" 
ON public.users FOR SELECT 
USING (
  account_id IN (
    SELECT u.account_id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
);