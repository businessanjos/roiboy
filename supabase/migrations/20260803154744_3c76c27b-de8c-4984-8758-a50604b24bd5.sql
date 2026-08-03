CREATE TABLE public.zapp_routing_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  contact_name text,
  phone_e164 text,
  detected_prefix text NOT NULL,
  expected_integration_id uuid,
  previous_integration_id uuid,
  expected_sector_id text,
  previous_sector_id text,
  prefix_message_count integer NOT NULL DEFAULT 0,
  total_message_count integer NOT NULL DEFAULT 0,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_zapp_routing_audit_conversation ON public.zapp_routing_audit_log (conversation_id, created_at DESC);
CREATE INDEX idx_zapp_routing_audit_account ON public.zapp_routing_audit_log (account_id, created_at DESC);

GRANT SELECT ON public.zapp_routing_audit_log TO authenticated;
GRANT ALL ON public.zapp_routing_audit_log TO service_role;

ALTER TABLE public.zapp_routing_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view routing audit of their account"
ON public.zapp_routing_audit_log
FOR SELECT
TO authenticated
USING (account_id = public.get_current_user_account_id());

CREATE POLICY "Service role manages routing audit"
ON public.zapp_routing_audit_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);