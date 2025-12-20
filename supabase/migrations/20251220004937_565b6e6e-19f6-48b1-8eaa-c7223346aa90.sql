-- Create a table to track rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL, -- IP address, phone number, or other identifier
  action TEXT NOT NULL, -- 'form_submit', 'event_checkin', 'login_attempt', etc.
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX idx_rate_limit_logs_lookup ON public.rate_limit_logs (identifier, action, created_at DESC);

-- Enable RLS but allow service role to manage
ALTER TABLE public.rate_limit_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins can view (for debugging)
CREATE POLICY "Super admins can view rate limit logs"
ON public.rate_limit_logs
FOR SELECT
USING (is_super_admin());

-- Service role will insert via edge functions
-- No insert policy needed as edge functions use service role

-- Auto-cleanup old entries (keep last 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limit_logs 
  WHERE created_at < now() - interval '24 hours';
END;
$$;

-- Create a helper function to check rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier TEXT,
  p_action TEXT,
  p_max_requests INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_count INTEGER;
BEGIN
  -- Count requests in the time window
  SELECT COUNT(*) INTO request_count
  FROM public.rate_limit_logs
  WHERE identifier = p_identifier
    AND action = p_action
    AND created_at > now() - (p_window_seconds || ' seconds')::interval;
  
  -- Return true if under limit, false if exceeded
  RETURN request_count < p_max_requests;
END;
$$;

-- Create a function to record a rate limit hit
CREATE OR REPLACE FUNCTION public.record_rate_limit_hit(
  p_identifier TEXT,
  p_action TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.rate_limit_logs (identifier, action)
  VALUES (p_identifier, p_action);
END;
$$;

-- Create table for security audit logs (login attempts, etc)
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL, -- 'login_success', 'login_failure', 'password_reset', 'admin_action', etc.
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_security_audit_event_type ON public.security_audit_logs (event_type, created_at DESC);
CREATE INDEX idx_security_audit_user ON public.security_audit_logs (user_id, created_at DESC);
CREATE INDEX idx_security_audit_account ON public.security_audit_logs (account_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Super admins can view all security logs
CREATE POLICY "Super admins can view all security audit logs"
ON public.security_audit_logs
FOR SELECT
USING (is_super_admin());

-- Account admins can view their account's security logs
CREATE POLICY "Account admins can view their security audit logs"
ON public.security_audit_logs
FOR SELECT
USING (
  account_id = get_user_account_id() 
  AND is_account_owner()
);

-- Allow inserts from service role (edge functions)
-- No public insert policy needed