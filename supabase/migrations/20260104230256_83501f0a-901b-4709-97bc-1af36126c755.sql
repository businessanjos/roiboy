-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can create chats in their account" ON public.internal_chats;

-- Create new INSERT policy that properly sets created_by
CREATE POLICY "Users can create chats in their account" 
ON public.internal_chats 
FOR INSERT 
TO authenticated
WITH CHECK (
  account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
  AND created_by = public.get_current_user_id()
);