-- Fix the get_user_account_id function using CREATE OR REPLACE
-- The function already has SECURITY DEFINER which should bypass RLS
-- But let's ensure it's configured correctly

CREATE OR REPLACE FUNCTION public.get_user_account_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT account_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1
$$;

-- Also fix the policy on users table that causes recursion
-- The SELECT policy uses get_user_account_id() which queries the same table

DROP POLICY IF EXISTS "Users can view users in their account" ON public.users;

CREATE POLICY "Users can view users in their account" 
ON public.users 
FOR SELECT 
TO authenticated
USING (
  account_id = (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)
);

-- The INSERT policy for internal_chats should also be fixed
DROP POLICY IF EXISTS "Users can create chats in their account" ON public.internal_chats;

CREATE POLICY "Users can create chats in their account" 
ON public.internal_chats 
FOR INSERT 
TO authenticated
WITH CHECK (
  account_id = (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)
);