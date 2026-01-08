-- Drop the existing policy that allows all authenticated users to view users in their account
DROP POLICY IF EXISTS "Users can view users in their account" ON public.users;

-- Create a new policy that allows:
-- 1. Users to view their own profile
-- 2. Admins (is_account_owner) to view all users in their account
CREATE POLICY "Users can view their own profile or admins can view all" ON public.users
FOR SELECT TO authenticated
USING (
  auth_user_id = auth.uid() 
  OR (
    account_id = get_user_account_id() 
    AND is_account_owner()
  )
);