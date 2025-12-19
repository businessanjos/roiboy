-- Drop existing ALL policies that may be incomplete
DROP POLICY IF EXISTS "Super admins can manage plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Super admins can manage subscription_plans" ON public.subscription_plans;

-- Create specific policies for each operation
CREATE POLICY "Super admins can insert plans" 
ON public.subscription_plans 
FOR INSERT 
WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can update plans" 
ON public.subscription_plans 
FOR UPDATE 
USING (is_super_admin())
WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can delete plans" 
ON public.subscription_plans 
FOR DELETE 
USING (is_super_admin());