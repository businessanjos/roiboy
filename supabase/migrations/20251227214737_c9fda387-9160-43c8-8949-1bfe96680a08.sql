-- Create boletos (bank slips) table
CREATE TABLE public.boletos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  financial_entry_id UUID REFERENCES public.financial_entries(id) ON DELETE SET NULL,
  
  -- Boleto info
  barcode TEXT,
  digitable_line TEXT,
  our_number TEXT,
  document_number TEXT,
  
  -- Values
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  interest_amount NUMERIC(12,2) DEFAULT 0,
  fine_amount NUMERIC(12,2) DEFAULT 0,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  
  -- Dates
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  payment_date DATE,
  
  -- Status: pending, paid, cancelled, overdue
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Bank info
  bank_code TEXT,
  bank_name TEXT,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  
  -- External integration
  external_id TEXT,
  external_url TEXT,
  pdf_url TEXT,
  
  description TEXT,
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notas fiscais (invoices) table
CREATE TABLE public.notas_fiscais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  financial_entry_id UUID REFERENCES public.financial_entries(id) ON DELETE SET NULL,
  
  -- Invoice type: nfse (services), nfe (products)
  invoice_type TEXT NOT NULL DEFAULT 'nfse',
  
  -- Invoice info
  invoice_number TEXT,
  series TEXT,
  access_key TEXT, -- Chave de acesso (44 digits for NFe)
  verification_code TEXT, -- Código de verificação NFSe
  
  -- Values
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  services_amount NUMERIC(12,2) DEFAULT 0,
  products_amount NUMERIC(12,2) DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  
  -- Taxes
  iss_amount NUMERIC(12,2) DEFAULT 0,
  iss_rate NUMERIC(5,2) DEFAULT 0,
  icms_amount NUMERIC(12,2) DEFAULT 0,
  icms_rate NUMERIC(5,2) DEFAULT 0,
  pis_amount NUMERIC(12,2) DEFAULT 0,
  cofins_amount NUMERIC(12,2) DEFAULT 0,
  ir_amount NUMERIC(12,2) DEFAULT 0,
  csll_amount NUMERIC(12,2) DEFAULT 0,
  inss_amount NUMERIC(12,2) DEFAULT 0,
  
  -- Dates
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  competence_date DATE, -- Mês de competência
  
  -- Status: draft, issued, cancelled, rejected
  status TEXT NOT NULL DEFAULT 'draft',
  cancellation_reason TEXT,
  
  -- Service/Product info
  service_code TEXT, -- Código do serviço municipal
  cnae_code TEXT,
  description TEXT,
  
  -- External integration
  external_id TEXT,
  xml_url TEXT,
  pdf_url TEXT,
  
  -- City info for NFSe
  city_code TEXT,
  city_name TEXT,
  
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.boletos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;

-- RLS policies for boletos
CREATE POLICY "Users can view boletos from their account" 
ON public.boletos FOR SELECT 
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can create boletos in their account" 
ON public.boletos FOR INSERT 
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update boletos in their account" 
ON public.boletos FOR UPDATE 
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete boletos in their account" 
ON public.boletos FOR DELETE 
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

-- RLS policies for notas_fiscais
CREATE POLICY "Users can view notas_fiscais from their account" 
ON public.notas_fiscais FOR SELECT 
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can create notas_fiscais in their account" 
ON public.notas_fiscais FOR INSERT 
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update notas_fiscais in their account" 
ON public.notas_fiscais FOR UPDATE 
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete notas_fiscais in their account" 
ON public.notas_fiscais FOR DELETE 
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

-- Indexes
CREATE INDEX idx_boletos_account_id ON public.boletos(account_id);
CREATE INDEX idx_boletos_client_id ON public.boletos(client_id);
CREATE INDEX idx_boletos_due_date ON public.boletos(due_date);
CREATE INDEX idx_boletos_status ON public.boletos(status);

CREATE INDEX idx_notas_fiscais_account_id ON public.notas_fiscais(account_id);
CREATE INDEX idx_notas_fiscais_client_id ON public.notas_fiscais(client_id);
CREATE INDEX idx_notas_fiscais_invoice_type ON public.notas_fiscais(invoice_type);
CREATE INDEX idx_notas_fiscais_status ON public.notas_fiscais(status);

-- Triggers for updated_at
CREATE TRIGGER update_boletos_updated_at
  BEFORE UPDATE ON public.boletos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notas_fiscais_updated_at
  BEFORE UPDATE ON public.notas_fiscais
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();