-- Create login_attempts table to track failed login attempts
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  ip_address text,
  user_agent text,
  success boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for efficient lookup
CREATE INDEX idx_login_attempts_email_created ON public.login_attempts(email, created_at DESC);
CREATE INDEX idx_login_attempts_ip_created ON public.login_attempts(ip_address, created_at DESC);

-- Enable RLS
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Only super admins can view login attempts (for security analysis)
CREATE POLICY "Super admins can view login_attempts"
ON public.login_attempts
FOR SELECT
USING (is_super_admin());

-- Allow inserts from service role (edge functions)
-- No direct user insert policy needed as this is handled by edge functions

-- Create user_sessions table to track active sessions
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  session_token text NOT NULL,
  ip_address text,
  user_agent text,
  device_fingerprint text,
  city text,
  country text,
  is_trusted boolean NOT NULL DEFAULT false,
  last_active_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_session_token ON public.user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires ON public.user_sessions(expires_at);

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
CREATE POLICY "Users can view their sessions"
ON public.user_sessions
FOR SELECT
USING (account_id = get_user_account_id());

-- Users can delete their own sessions (logout from device)
CREATE POLICY "Users can delete their sessions"
ON public.user_sessions
FOR DELETE
USING (account_id = get_user_account_id());

-- Users can insert sessions (handled by edge function with service role)
CREATE POLICY "Users can insert their sessions"
ON public.user_sessions
FOR INSERT
WITH CHECK (account_id = get_user_account_id());

-- Users can update their sessions
CREATE POLICY "Users can update their sessions"
ON public.user_sessions
FOR UPDATE
USING (account_id = get_user_account_id());

-- Create function to check if account is locked
CREATE OR REPLACE FUNCTION public.is_account_locked(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  failed_count integer;
BEGIN
  -- Count failed attempts in last 15 minutes
  SELECT COUNT(*) INTO failed_count
  FROM public.login_attempts
  WHERE email = lower(p_email)
    AND success = false
    AND created_at > now() - interval '15 minutes';
  
  RETURN failed_count >= 5;
END;
$$;

-- Create function to record login attempt
CREATE OR REPLACE FUNCTION public.record_login_attempt(
  p_email text,
  p_ip_address text,
  p_user_agent text,
  p_success boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.login_attempts (email, ip_address, user_agent, success)
  VALUES (lower(p_email), p_ip_address, p_user_agent, p_success);
END;
$$;

-- Create function to check if session is from new device
CREATE OR REPLACE FUNCTION public.is_new_device(
  p_user_id uuid,
  p_device_fingerprint text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public.user_sessions
    WHERE user_id = p_user_id
      AND device_fingerprint = p_device_fingerprint
      AND is_trusted = true
  );
END;
$$;

-- Create function to cleanup old login attempts (run daily)
CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete login attempts older than 30 days
  DELETE FROM public.login_attempts 
  WHERE created_at < now() - interval '30 days';
  
  -- Delete expired sessions
  DELETE FROM public.user_sessions
  WHERE expires_at < now();
END;
$$;