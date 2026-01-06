-- Create table for storing client link suggestions
CREATE TABLE public.zapp_client_suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  zapp_conversation_id UUID NOT NULL REFERENCES public.zapp_conversations(id) ON DELETE CASCADE,
  suggested_client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL, -- 'name', 'partial_phone', 'similar_name'
  match_score NUMERIC(3,2) DEFAULT 0.50, -- 0.00 to 1.00
  match_details JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(zapp_conversation_id, suggested_client_id)
);

-- Create indexes for performance
CREATE INDEX idx_zapp_client_suggestions_conversation ON public.zapp_client_suggestions(zapp_conversation_id);
CREATE INDEX idx_zapp_client_suggestions_account_status ON public.zapp_client_suggestions(account_id, status);

-- Enable RLS
ALTER TABLE public.zapp_client_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view suggestions for their account"
ON public.zapp_client_suggestions FOR SELECT
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert suggestions for their account"
ON public.zapp_client_suggestions FOR INSERT
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update suggestions for their account"
ON public.zapp_client_suggestions FOR UPDATE
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete suggestions for their account"
ON public.zapp_client_suggestions FOR DELETE
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_zapp_client_suggestions_updated_at
BEFORE UPDATE ON public.zapp_client_suggestions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();