
-- Create service providers table
CREATE TABLE public.hr_service_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  cpf TEXT,
  rg TEXT,
  cnpj TEXT,
  company_name TEXT,
  trade_name TEXT,
  birth_date DATE,
  gender TEXT,
  marital_status TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  department TEXT,
  hr_department_id UUID REFERENCES public.hr_departments(id) ON DELETE SET NULL,
  service_type TEXT,
  position TEXT,
  hire_date DATE,
  termination_date DATE,
  fee_amount NUMERIC,
  payment_method TEXT,
  status TEXT DEFAULT 'active',
  avatar_url TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hr_service_providers ENABLE ROW LEVEL SECURITY;

-- RLS policies using get_my_account_id()
CREATE POLICY "Users can view service providers of their account"
  ON public.hr_service_providers FOR SELECT
  TO authenticated
  USING (account_id = public.get_my_account_id());

CREATE POLICY "Users can create service providers for their account"
  ON public.hr_service_providers FOR INSERT
  TO authenticated
  WITH CHECK (account_id = public.get_my_account_id());

CREATE POLICY "Users can update service providers of their account"
  ON public.hr_service_providers FOR UPDATE
  TO authenticated
  USING (account_id = public.get_my_account_id());

CREATE POLICY "Users can delete service providers of their account"
  ON public.hr_service_providers FOR DELETE
  TO authenticated
  USING (account_id = public.get_my_account_id());

-- Trigger for updated_at
CREATE TRIGGER update_hr_service_providers_updated_at
  BEFORE UPDATE ON public.hr_service_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
