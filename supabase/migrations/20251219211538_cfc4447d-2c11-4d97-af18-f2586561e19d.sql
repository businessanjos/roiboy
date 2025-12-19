-- Check if user is account owner (admin role)
-- Account owners have all permissions regardless of team role
CREATE OR REPLACE FUNCTION public.is_account_owner(_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = COALESCE(_user_id, (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1))
      AND u.role = 'admin'
  )
$$;