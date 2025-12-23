-- Add is_also_admin column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_also_admin boolean NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.users.is_also_admin IS 'When true, user has admin privileges in addition to their team role (e.g., Mentor with admin access)';