
CREATE TABLE public.hr_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  department_id UUID REFERENCES public.hr_departments(id) ON DELETE SET NULL,
  seniority TEXT,
  salary_min NUMERIC,
  salary_max NUMERIC,
  description TEXT,
  responsibilities TEXT[] DEFAULT '{}',
  technical_skills TEXT[] DEFAULT '{}',
  behavioral_skills TEXT[] DEFAULT '{}',
  requirements TEXT,
  education_level TEXT,
  experience_years INTEGER,
  career_path TEXT,
  next_position_id UUID REFERENCES public.hr_positions(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hr_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view positions in their account"
ON public.hr_positions FOR SELECT TO authenticated
USING (account_id = (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can create positions in their account"
ON public.hr_positions FOR INSERT TO authenticated
WITH CHECK (account_id = (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update positions in their account"
ON public.hr_positions FOR UPDATE TO authenticated
USING (account_id = (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete positions in their account"
ON public.hr_positions FOR DELETE TO authenticated
USING (account_id = (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE TRIGGER update_hr_positions_updated_at
BEFORE UPDATE ON public.hr_positions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
