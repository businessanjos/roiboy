-- Custom fields definitions
CREATE TABLE public.custom_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('select', 'boolean', 'multi_select', 'number', 'currency', 'text', 'date')),
  options JSONB DEFAULT '[]'::jsonb,
  is_required BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client field values
CREATE TABLE public.client_field_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  value_text TEXT,
  value_number NUMERIC,
  value_boolean BOOLEAN,
  value_date DATE,
  value_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, field_id)
);

-- Enable RLS
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_field_values ENABLE ROW LEVEL SECURITY;

-- Custom fields policies
CREATE POLICY "Users can view custom fields in their account" 
ON public.custom_fields FOR SELECT 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert custom fields in their account" 
ON public.custom_fields FOR INSERT 
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update custom fields in their account" 
ON public.custom_fields FOR UPDATE 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete custom fields in their account" 
ON public.custom_fields FOR DELETE 
USING (account_id = get_user_account_id());

-- Client field values policies
CREATE POLICY "Users can view client field values in their account" 
ON public.client_field_values FOR SELECT 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert client field values in their account" 
ON public.client_field_values FOR INSERT 
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update client field values in their account" 
ON public.client_field_values FOR UPDATE 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete client field values in their account" 
ON public.client_field_values FOR DELETE 
USING (account_id = get_user_account_id());

-- Triggers for updated_at
CREATE TRIGGER update_custom_fields_updated_at
BEFORE UPDATE ON public.custom_fields
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_field_values_updated_at
BEFORE UPDATE ON public.client_field_values
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_custom_fields_account ON public.custom_fields(account_id);
CREATE INDEX idx_client_field_values_client ON public.client_field_values(client_id);
CREATE INDEX idx_client_field_values_field ON public.client_field_values(field_id);