-- Add show_in_leads column to custom_fields
ALTER TABLE public.custom_fields 
ADD COLUMN show_in_leads boolean NOT NULL DEFAULT false;

-- Create lead_field_values table (similar to client_field_values)
CREATE TABLE public.lead_field_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  value_text TEXT,
  value_number NUMERIC,
  value_boolean BOOLEAN,
  value_date DATE,
  value_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id, field_id)
);

-- Enable RLS
ALTER TABLE public.lead_field_values ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view lead field values from their account"
ON public.lead_field_values
FOR SELECT
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert lead field values to their account"
ON public.lead_field_values
FOR INSERT
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update lead field values in their account"
ON public.lead_field_values
FOR UPDATE
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete lead field values from their account"
ON public.lead_field_values
FOR DELETE
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

-- Index for faster lookups
CREATE INDEX idx_lead_field_values_lead_id ON public.lead_field_values(lead_id);
CREATE INDEX idx_lead_field_values_field_id ON public.lead_field_values(field_id);