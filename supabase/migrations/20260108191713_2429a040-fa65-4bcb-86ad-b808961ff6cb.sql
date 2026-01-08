-- Drop and recreate RLS policies for instagram_profiles with correct auth check
DROP POLICY IF EXISTS "Users can view their account instagram profiles" ON public.instagram_profiles;
DROP POLICY IF EXISTS "Users can insert instagram profiles for their account" ON public.instagram_profiles;
DROP POLICY IF EXISTS "Users can update their account instagram profiles" ON public.instagram_profiles;
DROP POLICY IF EXISTS "Users can delete their account instagram profiles" ON public.instagram_profiles;

-- Create corrected policies using auth_user_id
CREATE POLICY "Users can view their account instagram profiles" 
ON public.instagram_profiles 
FOR SELECT 
USING (account_id IN (
  SELECT users.account_id 
  FROM users 
  WHERE users.auth_user_id = auth.uid()
));

CREATE POLICY "Users can insert instagram profiles for their account" 
ON public.instagram_profiles 
FOR INSERT 
WITH CHECK (account_id IN (
  SELECT users.account_id 
  FROM users 
  WHERE users.auth_user_id = auth.uid()
));

CREATE POLICY "Users can update their account instagram profiles" 
ON public.instagram_profiles 
FOR UPDATE 
USING (account_id IN (
  SELECT users.account_id 
  FROM users 
  WHERE users.auth_user_id = auth.uid()
));

CREATE POLICY "Users can delete their account instagram profiles" 
ON public.instagram_profiles 
FOR DELETE 
USING (account_id IN (
  SELECT users.account_id 
  FROM users 
  WHERE users.auth_user_id = auth.uid()
));