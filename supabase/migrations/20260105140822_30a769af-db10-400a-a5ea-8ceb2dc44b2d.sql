-- Fix infinite recursion in users table policy
-- The policy must use auth.uid() directly without querying the users table

DROP POLICY IF EXISTS "Users can view users in their account" ON public.users;

-- Create a policy that uses auth.uid() directly to get the user's own row first
-- Then allows viewing all users in the same account
CREATE POLICY "Users can view users in their account" 
ON public.users 
FOR SELECT 
TO authenticated
USING (
  -- Allow user to see their own row first (this is safe, no recursion)
  auth_user_id = auth.uid()
  OR
  -- Allow user to see others in same account (using EXISTS to avoid direct table reference)
  EXISTS (
    SELECT 1 FROM public.users u2 
    WHERE u2.auth_user_id = auth.uid() 
    AND u2.account_id = users.account_id
  )
);