-- Fix the users SELECT policy to avoid ANY table queries
-- Use only auth.uid() directly - the simplest possible approach

DROP POLICY IF EXISTS "Users can view users in their account" ON public.users;

-- First, let user see their own row (no recursion possible)
CREATE POLICY "Users can view own row" 
ON public.users 
FOR SELECT 
TO authenticated
USING (auth_user_id = auth.uid());

-- Second, use a materialized approach via a security definer function
-- that caches the result to avoid recursion

-- Recreate the function with IMMUTABLE to allow caching
CREATE OR REPLACE FUNCTION public.get_my_account_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_account_id uuid;
BEGIN
  -- Direct query bypassing RLS due to SECURITY DEFINER
  SELECT account_id INTO v_account_id 
  FROM public.users 
  WHERE auth_user_id = auth.uid() 
  LIMIT 1;
  
  RETURN v_account_id;
END;
$$;

-- Now create a separate policy for viewing teammates
CREATE POLICY "Users can view teammates in same account" 
ON public.users 
FOR SELECT 
TO authenticated
USING (account_id = public.get_my_account_id());