-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  user_name text,
  user_email text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_name text,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_audit_logs_account_id ON public.audit_logs(account_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity_type ON public.audit_logs(entity_type);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view audit logs in their account"
ON public.audit_logs
FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert audit logs in their account"
ON public.audit_logs
FOR INSERT
WITH CHECK (account_id = get_user_account_id());

-- Super admins can view all audit logs
CREATE POLICY "Super admins can view all audit logs"
ON public.audit_logs
FOR SELECT
USING (is_super_admin());