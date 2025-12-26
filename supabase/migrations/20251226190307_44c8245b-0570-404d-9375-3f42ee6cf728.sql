-- Fix RLS policies for zapp_tags to use auth_user_id instead of id
DROP POLICY IF EXISTS "Users can view tags in their account" ON public.zapp_tags;
DROP POLICY IF EXISTS "Users can insert tags in their account" ON public.zapp_tags;
DROP POLICY IF EXISTS "Users can update tags in their account" ON public.zapp_tags;
DROP POLICY IF EXISTS "Users can delete tags in their account" ON public.zapp_tags;

-- Create corrected policies using auth_user_id
CREATE POLICY "Users can view tags in their account" 
ON public.zapp_tags FOR SELECT 
USING (account_id IN (
  SELECT users.account_id FROM users WHERE users.auth_user_id = auth.uid()
));

CREATE POLICY "Users can insert tags in their account" 
ON public.zapp_tags FOR INSERT 
WITH CHECK (account_id IN (
  SELECT users.account_id FROM users WHERE users.auth_user_id = auth.uid()
));

CREATE POLICY "Users can update tags in their account" 
ON public.zapp_tags FOR UPDATE 
USING (account_id IN (
  SELECT users.account_id FROM users WHERE users.auth_user_id = auth.uid()
));

CREATE POLICY "Users can delete tags in their account" 
ON public.zapp_tags FOR DELETE 
USING (account_id IN (
  SELECT users.account_id FROM users WHERE users.auth_user_id = auth.uid()
));