-- Corrigir função is_account_owner para reconhecer is_also_admin
CREATE OR REPLACE FUNCTION public.is_account_owner(_user_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = COALESCE(_user_id, (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1))
      AND (u.role = 'admin' OR u.is_also_admin = true)
  )
$$;