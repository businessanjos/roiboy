-- Allow super admins to view all clients (for counting)
CREATE POLICY "Super admins can view all clients" 
ON public.clients 
FOR SELECT 
USING (is_super_admin());

-- Allow super admins to manage subscription_plans
CREATE POLICY "Super admins can manage subscription_plans" 
ON public.subscription_plans 
FOR ALL 
USING (is_super_admin());

-- Allow users to view active subscription_plans (for account settings)
CREATE POLICY "Users can view active plans" 
ON public.subscription_plans 
FOR SELECT 
TO authenticated
USING (is_active = true);