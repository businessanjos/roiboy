-- Add user_email column to user_integrations table if it doesn't exist
ALTER TABLE public.user_integrations 
ADD COLUMN IF NOT EXISTS user_email text;

COMMENT ON COLUMN public.user_integrations.user_email IS 'Email da conta conectada (ex: "user@gmail.com")';