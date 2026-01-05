-- Create a helper function to get account_id that bypasses RLS completely
CREATE OR REPLACE FUNCTION public.get_my_account_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT account_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_my_account_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_account_id() TO anon;

-- Now fix the users policy to use the helper function
DROP POLICY IF EXISTS "Users can view users in their account" ON public.users;

CREATE POLICY "Users can view users in their account" 
ON public.users 
FOR SELECT 
TO authenticated
USING (
  auth_user_id = auth.uid()
  OR
  account_id = public.get_my_account_id()
);

-- Fix internal_chats INSERT policy too
DROP POLICY IF EXISTS "Users can create chats in their account" ON public.internal_chats;

CREATE POLICY "Users can create chats in their account" 
ON public.internal_chats 
FOR INSERT 
TO authenticated
WITH CHECK (account_id = public.get_my_account_id());

-- Fix internal_chat_participants INSERT policy
DROP POLICY IF EXISTS "Users can add participants to chats they created" ON public.internal_chat_participants;

CREATE POLICY "Users can add participants to chats they created"
ON public.internal_chat_participants
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.internal_chats c
    WHERE c.id = chat_id 
    AND c.account_id = public.get_my_account_id()
  )
);