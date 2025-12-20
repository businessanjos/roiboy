-- Add INSERT policy for security_audit_logs
CREATE POLICY "Users can insert their own security audit logs"
ON public.security_audit_logs
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- Add policy for service role to insert (for edge functions)
CREATE POLICY "Service can insert security audit logs"
ON public.security_audit_logs
FOR INSERT
WITH CHECK (true);