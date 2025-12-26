-- Add zAPP configuration to account_settings for role-based agent assignment
ALTER TABLE public.account_settings 
ADD COLUMN IF NOT EXISTS zapp_allowed_roles jsonb DEFAULT '[]'::jsonb;

-- Add comment
COMMENT ON COLUMN public.account_settings.zapp_allowed_roles IS 'Array of team_role_ids that can act as zAPP agents';

-- Simplify zapp_agents to just track online status and settings per user
-- Remove the role column since we'll use team_roles instead
ALTER TABLE public.zapp_agents DROP COLUMN IF EXISTS role;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_zapp_agents_user_id ON public.zapp_agents(user_id);

-- Update RLS policies to allow users to see all agents in their account (for assignment)
DROP POLICY IF EXISTS "Users can view agents in their account" ON public.zapp_agents;
CREATE POLICY "Users can view agents in their account" 
ON public.zapp_agents 
FOR SELECT 
USING (account_id = get_user_account_id());

-- Allow users to update their own agent status (online/offline)
DROP POLICY IF EXISTS "Users can update their own agent status" ON public.zapp_agents;
CREATE POLICY "Users can update their own agent status" 
ON public.zapp_agents 
FOR UPDATE 
USING (account_id = get_user_account_id() AND user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1));

-- Admins can manage all agents
DROP POLICY IF EXISTS "Admins can manage agents" ON public.zapp_agents;
CREATE POLICY "Admins can manage agents" 
ON public.zapp_agents 
FOR ALL 
USING (account_id = get_user_account_id() AND is_account_owner());

-- Allow inserting agents for admins
DROP POLICY IF EXISTS "Admins can insert agents" ON public.zapp_agents;
CREATE POLICY "Admins can insert agents" 
ON public.zapp_agents 
FOR INSERT 
WITH CHECK (account_id = get_user_account_id() AND is_account_owner());