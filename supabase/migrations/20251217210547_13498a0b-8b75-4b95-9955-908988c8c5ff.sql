-- Create table to track forms sent to clients
CREATE TABLE public.client_form_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, form_id)
);

-- Enable RLS
ALTER TABLE public.client_form_sends ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view form sends in their account" 
ON public.client_form_sends 
FOR SELECT 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert form sends in their account" 
ON public.client_form_sends 
FOR INSERT 
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update form sends in their account" 
ON public.client_form_sends 
FOR UPDATE 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete form sends in their account" 
ON public.client_form_sends 
FOR DELETE 
USING (account_id = get_user_account_id());

-- Create index for faster lookups
CREATE INDEX idx_client_form_sends_client ON public.client_form_sends(client_id);
CREATE INDEX idx_client_form_sends_pending ON public.client_form_sends(client_id) WHERE responded_at IS NULL;