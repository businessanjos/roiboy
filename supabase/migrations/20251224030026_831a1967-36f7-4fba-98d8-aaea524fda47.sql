-- Create table for customizable client pipeline stages
CREATE TABLE public.client_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for ordering
CREATE INDEX idx_client_stages_order ON public.client_stages(account_id, display_order);

-- Enable RLS
ALTER TABLE public.client_stages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view stages in their account"
ON public.client_stages FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert stages in their account"
ON public.client_stages FOR INSERT
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update stages in their account"
ON public.client_stages FOR UPDATE
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete stages in their account"
ON public.client_stages FOR DELETE
USING (account_id = get_user_account_id());

-- Add stage_id to clients table
ALTER TABLE public.clients ADD COLUMN stage_id UUID REFERENCES public.client_stages(id) ON DELETE SET NULL;

-- Add index for stage filtering
CREATE INDEX idx_clients_stage ON public.clients(account_id, stage_id);

-- Create trigger for updated_at
CREATE TRIGGER update_client_stages_updated_at
  BEFORE UPDATE ON public.client_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();