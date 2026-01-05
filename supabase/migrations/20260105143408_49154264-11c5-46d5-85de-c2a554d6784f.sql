-- Fix infinite recursion in RLS policies for users table
-- The issue is that get_user_account_id() and is_account_owner() query the users table,
-- which triggers RLS policies that call these same functions, causing infinite recursion.

-- Drop the problematic policy that uses a subquery on users table
DROP POLICY IF EXISTS "Users can view teammates in same account" ON public.users;

-- Recreate get_user_account_id with SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION public.get_user_account_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1
$$;

-- Recreate is_account_owner with SECURITY DEFINER to bypass RLS
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

-- Recreate the teammates policy using the fixed function
CREATE POLICY "Users can view teammates in same account"
ON public.users
FOR SELECT
TO authenticated
USING (account_id = get_user_account_id());