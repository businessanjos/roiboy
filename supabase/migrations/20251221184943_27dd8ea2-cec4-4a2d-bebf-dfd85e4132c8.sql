-- 1. Fix subscription_plans: Remove public access and require authentication
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.subscription_plans;

-- Create policy for authenticated users only
CREATE POLICY "Authenticated users can view active plans" 
ON public.subscription_plans 
FOR SELECT 
TO authenticated
USING (is_active = true);

-- Super admins can manage all plans
CREATE POLICY "Super admins can manage subscription_plans" 
ON public.subscription_plans 
FOR ALL 
USING (is_super_admin());

-- 2. Fix events_checkin_view: Enable RLS and add proper policies
-- Note: Views inherit RLS from underlying tables, but we should ensure the view only exposes necessary data
-- The view already queries from events table which has RLS, but let's verify and add explicit security

-- Create a security definer function for public checkin access (only with valid checkin_code)
CREATE OR REPLACE FUNCTION public.get_event_for_checkin(p_checkin_code TEXT)
RETURNS TABLE (
  id UUID,
  title TEXT,
  account_id UUID,
  scheduled_at TIMESTAMPTZ,
  modality event_modality,
  address TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.title, e.account_id, e.scheduled_at, e.modality, e.address
  FROM events e
  WHERE e.checkin_code = p_checkin_code
  LIMIT 1;
$$;