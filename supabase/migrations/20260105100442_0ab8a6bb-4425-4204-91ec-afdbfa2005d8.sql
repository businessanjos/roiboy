-- Drop and recreate INSERT policy using security definer function
DROP POLICY IF EXISTS "Users can create chats in their account" ON public.internal_chats;

-- Create helper function to get current user's account_id
CREATE OR REPLACE FUNCTION public.get_current_user_account_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1
$$;

-- Create simpler INSERT policy
CREATE POLICY "Users can create chats in their account"
ON public.internal_chats
FOR INSERT
TO authenticated
WITH CHECK (account_id = get_current_user_account_id());