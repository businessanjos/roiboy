
-- Create hr_collaborators table (hybrid: can optionally link to users table)
CREATE TABLE public.hr_collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
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
  position TEXT,
  hire_date DATE,
  termination_date DATE,
  employment_type TEXT DEFAULT 'clt',
  salary NUMERIC(12,2),
  status TEXT DEFAULT 'active',
  avatar_url TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_hr_collaborators_account ON public.hr_collaborators(account_id);
CREATE INDEX idx_hr_collaborators_user ON public.hr_collaborators(user_id);
CREATE INDEX idx_hr_collaborators_status ON public.hr_collaborators(status);

-- Enable RLS
ALTER TABLE public.hr_collaborators ENABLE ROW LEVEL SECURITY;

-- RLS Policies: same account access
CREATE POLICY "Users can view collaborators from their account"
ON public.hr_collaborators FOR SELECT
TO authenticated
USING (account_id = public.get_my_account_id());

CREATE POLICY "Users can create collaborators in their account"
ON public.hr_collaborators FOR INSERT
TO authenticated
WITH CHECK (account_id = public.get_my_account_id());

CREATE POLICY "Users can update collaborators in their account"
ON public.hr_collaborators FOR UPDATE
TO authenticated
USING (account_id = public.get_my_account_id());

CREATE POLICY "Users can delete collaborators in their account"
ON public.hr_collaborators FOR DELETE
TO authenticated
USING (account_id = public.get_my_account_id());

-- Trigger for updated_at
CREATE TRIGGER update_hr_collaborators_updated_at
BEFORE UPDATE ON public.hr_collaborators
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
