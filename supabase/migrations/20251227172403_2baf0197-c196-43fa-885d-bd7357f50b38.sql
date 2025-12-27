-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document TEXT,
  document_type TEXT DEFAULT 'cpf',
  email TEXT,
  phone TEXT,
  contact_name TEXT,
  street TEXT,
  street_number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  bank_name TEXT,
  bank_agency TEXT,
  bank_account TEXT,
  pix_key TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add supplier_id to financial_entries
ALTER TABLE public.financial_entries ADD COLUMN supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view suppliers from their account" ON public.suppliers
  FOR SELECT USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert suppliers in their account" ON public.suppliers
  FOR INSERT WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update suppliers in their account" ON public.suppliers
  FOR UPDATE USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete suppliers from their account" ON public.suppliers
  FOR DELETE USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();