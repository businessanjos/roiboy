
-- Create hr_partners table
CREATE TABLE public.hr_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  cpf TEXT,
  rg TEXT,
  birth_date DATE,
  gender TEXT,
  marital_status TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  department TEXT,
  hr_department_id UUID REFERENCES public.hr_departments(id),
  position TEXT,
  ownership_percentage NUMERIC,
  join_date DATE,
  exit_date DATE,
  pro_labore NUMERIC,
  status TEXT DEFAULT 'active',
  avatar_url TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hr_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view partners of their account"
  ON public.hr_partners FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can create partners for their account"
  ON public.hr_partners FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update partners of their account"
  ON public.hr_partners FOR UPDATE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete partners of their account"
  ON public.hr_partners FOR DELETE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE TRIGGER update_hr_partners_updated_at
  BEFORE UPDATE ON public.hr_partners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Move sócios (without user_id FK to avoid constraint issues)
INSERT INTO public.hr_partners (
  account_id, full_name, email, phone, cpf, rg, birth_date, gender,
  marital_status, address, city, state, zip_code, department, hr_department_id,
  position, status, avatar_url, emergency_contact_name, emergency_contact_phone, notes
)
SELECT
  account_id, full_name, email, phone, cpf, rg, birth_date, gender,
  marital_status, address, city, state, zip_code, department, hr_department_id,
  position, status, avatar_url, emergency_contact_name, emergency_contact_phone, notes
FROM public.hr_collaborators
WHERE employment_type = 'socio';

DELETE FROM public.hr_collaborators WHERE employment_type = 'socio';
