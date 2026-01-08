-- Drop and recreate RLS policies for instagram_posts with correct auth check
DROP POLICY IF EXISTS "Users can view posts of their profiles" ON public.instagram_posts;
DROP POLICY IF EXISTS "Users can insert posts for their profiles" ON public.instagram_posts;
DROP POLICY IF EXISTS "Users can update posts of their profiles" ON public.instagram_posts;
DROP POLICY IF EXISTS "Users can delete posts of their profiles" ON public.instagram_posts;

-- Create corrected policies using auth_user_id
CREATE POLICY "Users can view posts of their profiles" 
ON public.instagram_posts 
FOR SELECT 
USING (profile_id IN (
  SELECT ip.id 
  FROM instagram_profiles ip
  JOIN users u ON ip.account_id = u.account_id
  WHERE u.auth_user_id = auth.uid()
));

CREATE POLICY "Users can insert posts for their profiles" 
ON public.instagram_posts 
FOR INSERT 
WITH CHECK (profile_id IN (
  SELECT ip.id 
  FROM instagram_profiles ip
  JOIN users u ON ip.account_id = u.account_id
  WHERE u.auth_user_id = auth.uid()
));

CREATE POLICY "Users can update posts of their profiles" 
ON public.instagram_posts 
FOR UPDATE 
USING (profile_id IN (
  SELECT ip.id 
  FROM instagram_profiles ip
  JOIN users u ON ip.account_id = u.account_id
  WHERE u.auth_user_id = auth.uid()
));

CREATE POLICY "Users can delete posts of their profiles" 
ON public.instagram_posts 
FOR DELETE 
USING (profile_id IN (
  SELECT ip.id 
  FROM instagram_profiles ip
  JOIN users u ON ip.account_id = u.account_id
  WHERE u.auth_user_id = auth.uid()
));