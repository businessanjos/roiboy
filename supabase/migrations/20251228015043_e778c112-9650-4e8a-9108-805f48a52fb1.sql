-- Create leads table with basic fields
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  source TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  responsible_user_id UUID REFERENCES public.users(id),
  converted_to_client_id UUID REFERENCES public.clients(id),
  converted_at TIMESTAMP WITH TIME ZONE,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Create policies using the helper function
CREATE POLICY "Users can view leads from their account" 
ON public.leads 
FOR SELECT 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can create leads in their account" 
ON public.leads 
FOR INSERT 
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update leads in their account" 
ON public.leads 
FOR UPDATE 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete leads in their account" 
ON public.leads 
FOR DELETE 
USING (account_id = get_user_account_id());

-- Add lead_id to deals table to link deals with leads
ALTER TABLE public.deals ADD COLUMN lead_id UUID REFERENCES public.leads(id);

-- Create index for performance
CREATE INDEX idx_leads_account_id ON public.leads(account_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_converted_to_client ON public.leads(converted_to_client_id);
CREATE INDEX idx_deals_lead_id ON public.deals(lead_id);

-- Trigger to update updated_at
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();