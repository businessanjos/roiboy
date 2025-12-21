-- Create business diagnostic table
CREATE TABLE public.client_diagnostics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  
  -- Informações da empresa
  business_sector text,
  business_segment text,
  company_size text, -- micro, pequena, media, grande
  employee_count integer,
  annual_revenue numeric,
  years_in_business integer,
  
  -- Estrutura organizacional
  has_formal_structure boolean DEFAULT false,
  has_defined_processes boolean DEFAULT false,
  has_financial_control boolean DEFAULT false,
  has_marketing_strategy boolean DEFAULT false,
  has_sales_team boolean DEFAULT false,
  has_digital_presence boolean DEFAULT false,
  
  -- Principais desafios
  main_challenges jsonb DEFAULT '[]'::jsonb,
  
  -- Objetivos
  short_term_goals text,
  long_term_goals text,
  
  -- Situação atual
  current_situation text,
  pain_points text,
  previous_solutions text,
  
  -- Expectativas
  expectations text,
  success_criteria text,
  
  -- Notas adicionais
  notes text,
  
  -- Metadata
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id),
  
  -- One diagnostic per client
  CONSTRAINT unique_client_diagnostic UNIQUE (client_id)
);

-- Enable RLS
ALTER TABLE public.client_diagnostics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view diagnostics in their account"
ON public.client_diagnostics FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert diagnostics in their account"
ON public.client_diagnostics FOR INSERT
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update diagnostics in their account"
ON public.client_diagnostics FOR UPDATE
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete diagnostics in their account"
ON public.client_diagnostics FOR DELETE
USING (account_id = get_user_account_id());

-- Update trigger
CREATE TRIGGER update_client_diagnostics_updated_at
BEFORE UPDATE ON public.client_diagnostics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_client_diagnostics_client_id ON public.client_diagnostics(client_id);
CREATE INDEX idx_client_diagnostics_account_id ON public.client_diagnostics(account_id);