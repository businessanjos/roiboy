
-- Create junction table for user-team_roles many-to-many
CREATE TABLE public.user_team_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  team_role_id uuid NOT NULL REFERENCES public.team_roles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, team_role_id)
);

-- Enable RLS
ALTER TABLE public.user_team_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view team roles in their account"
ON public.user_team_roles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u1
    JOIN public.users u2 ON u1.account_id = u2.account_id
    WHERE u1.id = user_team_roles.user_id
    AND u2.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage user team roles"
ON public.user_team_roles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u1
    JOIN public.users u2 ON u1.account_id = u2.account_id
    WHERE u1.id = user_team_roles.user_id
    AND u2.auth_user_id = auth.uid()
    AND (u2.role = 'admin' OR u2.is_also_admin = true)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u1
    JOIN public.users u2 ON u1.account_id = u2.account_id
    WHERE u1.id = user_team_roles.user_id
    AND u2.auth_user_id = auth.uid()
    AND (u2.role = 'admin' OR u2.is_also_admin = true)
  )
);

-- Migrate existing data from users.team_role_id to junction table
INSERT INTO public.user_team_roles (user_id, team_role_id)
SELECT id, team_role_id FROM public.users WHERE team_role_id IS NOT NULL
ON CONFLICT DO NOTHING;
