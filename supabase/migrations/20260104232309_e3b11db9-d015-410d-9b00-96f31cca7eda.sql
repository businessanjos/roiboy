-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can create chats in their account" ON public.internal_chats;

-- Create new INSERT policy - just check account_id, created_by can be set to any valid user in the same account
CREATE POLICY "Users can create chats in their account" 
ON public.internal_chats 
FOR INSERT 
TO authenticated
WITH CHECK (
  account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
);