
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  legal_name TEXT NOT NULL,
  document TEXT NOT NULL,
  trade_name TEXT,
  email TEXT,
  phone TEXT,
  address_zip TEXT,
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_neighborhood TEXT,
  address_city TEXT,
  address_state TEXT,
  ie TEXT,
  im TEXT,
  tax_regime TEXT CHECK (tax_regime IN ('simples','lucro_presumido','lucro_real','sas_barueri')),
  default_service_pct NUMERIC(5,2) NOT NULL DEFAULT 70.00,
  default_product_pct NUMERIC(5,2) NOT NULL DEFAULT 30.00,
  notazz_token TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT companies_document_unique UNIQUE (account_id, document),
  CONSTRAINT companies_split_check CHECK (default_service_pct + default_product_pct = 100)
);
CREATE INDEX idx_companies_account ON public.companies(account_id);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view companies in their account" ON public.companies
  FOR SELECT TO authenticated USING (account_id = public.get_user_account_id());
CREATE POLICY "Users insert companies in their account" ON public.companies
  FOR INSERT TO authenticated WITH CHECK (account_id = public.get_user_account_id());
CREATE POLICY "Users update companies in their account" ON public.companies
  FOR UPDATE TO authenticated USING (account_id = public.get_user_account_id());
CREATE POLICY "Users delete companies in their account" ON public.companies
  FOR DELETE TO authenticated USING (account_id = public.get_user_account_id());

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.payers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('cpf','cnpj')),
  document TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  email_billing TEXT,
  phone_billing TEXT,
  address_zip TEXT,
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_neighborhood TEXT,
  address_city TEXT,
  address_state TEXT,
  ie TEXT,
  im TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payers_document_unique UNIQUE (account_id, document)
);
CREATE INDEX idx_payers_account ON public.payers(account_id);
CREATE INDEX idx_payers_company ON public.payers(company_id);
CREATE INDEX idx_payers_document ON public.payers(document);
ALTER TABLE public.payers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view payers in their account" ON public.payers
  FOR SELECT TO authenticated USING (account_id = public.get_user_account_id());
CREATE POLICY "Users insert payers in their account" ON public.payers
  FOR INSERT TO authenticated WITH CHECK (account_id = public.get_user_account_id());
CREATE POLICY "Users update payers in their account" ON public.payers
  FOR UPDATE TO authenticated USING (account_id = public.get_user_account_id());
CREATE POLICY "Users delete payers in their account" ON public.payers
  FOR DELETE TO authenticated USING (account_id = public.get_user_account_id());

CREATE TRIGGER update_payers_updated_at BEFORE UPDATE ON public.payers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.client_payers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  payer_id UUID NOT NULL REFERENCES public.payers(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'self' CHECK (relationship IN ('self','spouse','company','parent','other')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_payers_unique UNIQUE (client_id, payer_id)
);
CREATE INDEX idx_client_payers_client ON public.client_payers(client_id);
CREATE INDEX idx_client_payers_payer ON public.client_payers(payer_id);
CREATE INDEX idx_client_payers_account ON public.client_payers(account_id);
ALTER TABLE public.client_payers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view client_payers in their account" ON public.client_payers
  FOR SELECT TO authenticated USING (account_id = public.get_user_account_id());
CREATE POLICY "Users insert client_payers in their account" ON public.client_payers
  FOR INSERT TO authenticated WITH CHECK (account_id = public.get_user_account_id());
CREATE POLICY "Users update client_payers in their account" ON public.client_payers
  FOR UPDATE TO authenticated USING (account_id = public.get_user_account_id());
CREATE POLICY "Users delete client_payers in their account" ON public.client_payers
  FOR DELETE TO authenticated USING (account_id = public.get_user_account_id());

CREATE TRIGGER update_client_payers_updated_at BEFORE UPDATE ON public.client_payers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
