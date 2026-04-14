
-- Create HR departments table
CREATE TABLE public.hr_departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT 'slate',
  head_collaborator_id UUID REFERENCES public.hr_collaborators(id) ON DELETE SET NULL,
  parent_department_id UUID REFERENCES public.hr_departments(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hr_departments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view hr_departments of their account"
ON public.hr_departments FOR SELECT
TO authenticated
USING (
  account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid())
);

CREATE POLICY "Users can insert hr_departments in their account"
ON public.hr_departments FOR INSERT
TO authenticated
WITH CHECK (
  account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid())
);

CREATE POLICY "Users can update hr_departments in their account"
ON public.hr_departments FOR UPDATE
TO authenticated
USING (
  account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid())
);

CREATE POLICY "Users can delete hr_departments in their account"
ON public.hr_departments FOR DELETE
TO authenticated
USING (
  account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid())
);

-- Add department_id to hr_collaborators for linking
ALTER TABLE public.hr_collaborators
ADD COLUMN IF NOT EXISTS hr_department_id UUID REFERENCES public.hr_departments(id) ON DELETE SET NULL;

-- Trigger for updated_at
CREATE TRIGGER update_hr_departments_updated_at
BEFORE UPDATE ON public.hr_departments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
