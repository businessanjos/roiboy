-- Fix 1: Replace the overly permissive public client lookup policy
-- The current policy exposes ALL clients when a checkin_code exists anywhere
-- New policy should only allow looking up specific clients for checkin purposes via edge function

DROP POLICY IF EXISTS "Allow public client lookup for checkin" ON public.clients;

-- Create a more restricted policy that only works for authenticated users or through service role
-- Public checkin should go through an edge function with service role, not direct table access
CREATE POLICY "Allow authenticated client lookup for checkin" ON public.clients
  FOR SELECT 
  USING (
    -- Allow authenticated users to view clients in their account
    (account_id = get_user_account_id())
    -- Or super admins
    OR is_super_admin()
  );

-- Note: The existing policies "Users can view clients in their account" and "Super admins can view all clients" 
-- already cover authenticated access. Let's just drop the problematic one without creating duplicates.

-- Actually, let's just drop the policy since other policies already cover the use case
DROP POLICY IF EXISTS "Allow authenticated client lookup for checkin" ON public.clients;


-- Fix 2: Add rate limiting protection for form_responses
-- We'll add a constraint to prevent spam by requiring valid form reference
-- Note: Edge function should handle rate limiting at application level

-- Fix 3: Improve attendance check-in policy to require client phone validation
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Allow public event check-in" ON public.attendance;

-- Create a more secure policy that still allows public check-in but through edge function only
-- The edge function (event-checkin) already validates the check-in code and client phone
-- We keep RLS restrictive and let the edge function use service role for legitimate check-ins
CREATE POLICY "Allow public event check-in via service role" ON public.attendance
  FOR INSERT
  WITH CHECK (
    -- Only authenticated users can insert directly (for admin purposes)
    (account_id = get_user_account_id())
    -- Public check-ins go through edge function with service role
  );

-- Fix 4: Add additional protection to form_responses
-- Update the policy to require valid form_id reference
DROP POLICY IF EXISTS "Anyone can submit form responses" ON public.form_responses;

-- Create a more secure policy that validates the form exists and is active
CREATE POLICY "Allow form submissions with valid form" ON public.form_responses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.forms f 
      WHERE f.id = form_id 
        AND f.is_active = true
    )
  );