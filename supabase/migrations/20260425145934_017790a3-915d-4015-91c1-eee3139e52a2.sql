-- Add force_relogin_at column to track when a user must re-authenticate
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS force_relogin_at timestamptz;

-- Trigger function: when role changes, set force_relogin_at = now()
CREATE OR REPLACE FUNCTION public.trigger_force_relogin_on_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE') AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.team_role_id IS DISTINCT FROM OLD.team_role_id OR NEW.is_also_admin IS DISTINCT FROM OLD.is_also_admin) THEN
    NEW.force_relogin_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_force_relogin_on_role_change ON public.users;
CREATE TRIGGER users_force_relogin_on_role_change
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.trigger_force_relogin_on_role_change();

-- RPC the client calls on each session check
CREATE OR REPLACE FUNCTION public.check_force_relogin(p_session_issued_at timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE auth_user_id = auth.uid()
      AND force_relogin_at IS NOT NULL
      AND force_relogin_at > p_session_issued_at
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_force_relogin(timestamptz) TO authenticated;

-- Mark Darlan now to force his immediate re-login
UPDATE public.users 
SET force_relogin_at = now() 
WHERE email = 'darlanferreira@anjosbusiness.com';