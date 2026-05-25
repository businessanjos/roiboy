
-- Fix 1: ai_sector_agents — restrict SELECT to users with access to that sector or super admins
DROP POLICY IF EXISTS "Users can view AI sector agents in their account" ON public.ai_sector_agents;

CREATE POLICY "Users can view AI sector agents they have access to"
ON public.ai_sector_agents
FOR SELECT
TO authenticated
USING (
  is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.user_sector_access usa
    JOIN public.users u ON u.id = usa.user_id
    WHERE u.auth_user_id = auth.uid()
      AND usa.sector_id = ai_sector_agents.sector_id
  )
);

-- Fix 2: ops_workload_ai_reports — remove the two unscoped permissive policies
DROP POLICY IF EXISTS "Authenticated can view ops AI reports" ON public.ops_workload_ai_reports;
DROP POLICY IF EXISTS "Authenticated can create ops AI reports" ON public.ops_workload_ai_reports;

-- Fix 3: support_messages — make super admin policy not bypass account ownership for non-admins
DROP POLICY IF EXISTS "Super admins can view all messages" ON public.support_messages;

CREATE POLICY "Super admins can view all messages"
ON public.support_messages
FOR SELECT
TO authenticated
USING (is_super_admin());
