-- Create table to track AI usage logs
CREATE TABLE public.ai_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  message_id UUID REFERENCES public.message_events(id),
  client_id UUID REFERENCES public.clients(id),
  roi_events_created INTEGER NOT NULL DEFAULT 0,
  risk_events_created INTEGER NOT NULL DEFAULT 0,
  life_events_created INTEGER NOT NULL DEFAULT 0,
  recommendations_created INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view ai_usage_logs in their account"
ON public.ai_usage_logs
FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert ai_usage_logs in their account"
ON public.ai_usage_logs
FOR INSERT
WITH CHECK (account_id = get_user_account_id());

-- Create index for faster queries
CREATE INDEX idx_ai_usage_logs_account_created ON public.ai_usage_logs(account_id, created_at DESC);