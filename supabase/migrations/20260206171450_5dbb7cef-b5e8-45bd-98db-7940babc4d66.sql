-- Create webhooks table
CREATE TABLE public.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST',
  headers JSONB DEFAULT '{}',
  payload_template JSONB,
  is_active BOOLEAN DEFAULT true,
  trigger_event TEXT,
  secret_key TEXT,
  last_triggered_at TIMESTAMPTZ,
  last_status_code INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users can manage webhooks of their account"
ON public.webhooks FOR ALL USING (
  account_id IN (SELECT account_id FROM users WHERE auth_user_id = auth.uid())
);

-- Updated at trigger
CREATE TRIGGER update_webhooks_updated_at
BEFORE UPDATE ON public.webhooks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();