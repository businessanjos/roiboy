-- Super admins can INSERT accounts
CREATE POLICY "Super admins can insert accounts" 
ON public.accounts 
FOR INSERT 
WITH CHECK (is_super_admin());

-- Super admins can DELETE accounts
CREATE POLICY "Super admins can delete accounts" 
ON public.accounts 
FOR DELETE 
USING (is_super_admin());

-- Super admins can manage account_settings
CREATE POLICY "Super admins can view all account_settings" 
ON public.account_settings 
FOR SELECT 
USING (is_super_admin());

CREATE POLICY "Super admins can insert account_settings" 
ON public.account_settings 
FOR INSERT 
WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can update account_settings" 
ON public.account_settings 
FOR UPDATE 
USING (is_super_admin());

CREATE POLICY "Super admins can delete account_settings" 
ON public.account_settings 
FOR DELETE 
USING (is_super_admin());

-- Super admins can INSERT users
CREATE POLICY "Super admins can insert users" 
ON public.users 
FOR INSERT 
WITH CHECK (is_super_admin());

-- Super admins can DELETE users
CREATE POLICY "Super admins can delete users" 
ON public.users 
FOR DELETE 
USING (is_super_admin());

-- Fix super_admins policies - drop ALL policy and create specific ones
DROP POLICY IF EXISTS "Super admins can manage super_admins" ON public.super_admins;

CREATE POLICY "Super admins can insert super_admins" 
ON public.super_admins 
FOR INSERT 
WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can delete super_admins" 
ON public.super_admins 
FOR DELETE 
USING (is_super_admin());