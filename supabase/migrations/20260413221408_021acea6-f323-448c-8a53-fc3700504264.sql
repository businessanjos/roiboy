
-- =============================================
-- HR DOCUMENTS
-- =============================================
CREATE TABLE public.hr_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  collaborator_id UUID NOT NULL REFERENCES public.hr_collaborators(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  issue_date DATE,
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  uploaded_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hr_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_documents_select" ON public.hr_documents FOR SELECT TO authenticated
  USING (account_id = public.get_my_account_id());
CREATE POLICY "hr_documents_insert" ON public.hr_documents FOR INSERT TO authenticated
  WITH CHECK (account_id = public.get_my_account_id());
CREATE POLICY "hr_documents_update" ON public.hr_documents FOR UPDATE TO authenticated
  USING (account_id = public.get_my_account_id());
CREATE POLICY "hr_documents_delete" ON public.hr_documents FOR DELETE TO authenticated
  USING (account_id = public.get_my_account_id());

CREATE TRIGGER update_hr_documents_updated_at
  BEFORE UPDATE ON public.hr_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_hr_documents_collaborator ON public.hr_documents(collaborator_id);
CREATE INDEX idx_hr_documents_expiry ON public.hr_documents(expiry_date) WHERE expiry_date IS NOT NULL;

-- =============================================
-- HR VACATION REQUESTS
-- =============================================
CREATE TABLE public.hr_vacation_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  collaborator_id UUID NOT NULL REFERENCES public.hr_collaborators(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL DEFAULT 'vacation',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hr_vacation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_vacation_select" ON public.hr_vacation_requests FOR SELECT TO authenticated
  USING (account_id = public.get_my_account_id());
CREATE POLICY "hr_vacation_insert" ON public.hr_vacation_requests FOR INSERT TO authenticated
  WITH CHECK (account_id = public.get_my_account_id());
CREATE POLICY "hr_vacation_update" ON public.hr_vacation_requests FOR UPDATE TO authenticated
  USING (account_id = public.get_my_account_id());
CREATE POLICY "hr_vacation_delete" ON public.hr_vacation_requests FOR DELETE TO authenticated
  USING (account_id = public.get_my_account_id());

CREATE TRIGGER update_hr_vacation_updated_at
  BEFORE UPDATE ON public.hr_vacation_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_hr_vacation_collaborator ON public.hr_vacation_requests(collaborator_id);
CREATE INDEX idx_hr_vacation_dates ON public.hr_vacation_requests(start_date, end_date);

-- =============================================
-- HR SALARY HISTORY
-- =============================================
CREATE TABLE public.hr_salary_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  collaborator_id UUID NOT NULL REFERENCES public.hr_collaborators(id) ON DELETE CASCADE,
  effective_date DATE NOT NULL,
  change_type TEXT NOT NULL DEFAULT 'adjustment',
  previous_salary NUMERIC(12,2),
  new_salary NUMERIC(12,2),
  previous_position TEXT,
  new_position TEXT,
  previous_department TEXT,
  new_department TEXT,
  reason TEXT,
  approved_by UUID REFERENCES public.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hr_salary_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_salary_select" ON public.hr_salary_history FOR SELECT TO authenticated
  USING (account_id = public.get_my_account_id());
CREATE POLICY "hr_salary_insert" ON public.hr_salary_history FOR INSERT TO authenticated
  WITH CHECK (account_id = public.get_my_account_id());
CREATE POLICY "hr_salary_update" ON public.hr_salary_history FOR UPDATE TO authenticated
  USING (account_id = public.get_my_account_id());
CREATE POLICY "hr_salary_delete" ON public.hr_salary_history FOR DELETE TO authenticated
  USING (account_id = public.get_my_account_id());

CREATE TRIGGER update_hr_salary_updated_at
  BEFORE UPDATE ON public.hr_salary_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_hr_salary_collaborator ON public.hr_salary_history(collaborator_id);

-- =============================================
-- HR TIME RECORDS
-- =============================================
CREATE TABLE public.hr_time_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  collaborator_id UUID NOT NULL REFERENCES public.hr_collaborators(id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  clock_in TIME,
  clock_out TIME,
  break_start TIME,
  break_end TIME,
  total_hours NUMERIC(5,2),
  overtime_hours NUMERIC(5,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'regular',
  justification TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(collaborator_id, record_date)
);

ALTER TABLE public.hr_time_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_time_select" ON public.hr_time_records FOR SELECT TO authenticated
  USING (account_id = public.get_my_account_id());
CREATE POLICY "hr_time_insert" ON public.hr_time_records FOR INSERT TO authenticated
  WITH CHECK (account_id = public.get_my_account_id());
CREATE POLICY "hr_time_update" ON public.hr_time_records FOR UPDATE TO authenticated
  USING (account_id = public.get_my_account_id());
CREATE POLICY "hr_time_delete" ON public.hr_time_records FOR DELETE TO authenticated
  USING (account_id = public.get_my_account_id());

CREATE TRIGGER update_hr_time_updated_at
  BEFORE UPDATE ON public.hr_time_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_hr_time_collaborator ON public.hr_time_records(collaborator_id);
CREATE INDEX idx_hr_time_date ON public.hr_time_records(record_date);

-- =============================================
-- HR BENEFITS
-- =============================================
CREATE TABLE public.hr_benefits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  collaborator_id UUID NOT NULL REFERENCES public.hr_collaborators(id) ON DELETE CASCADE,
  benefit_type TEXT NOT NULL,
  provider TEXT,
  plan_name TEXT,
  value NUMERIC(12,2) DEFAULT 0,
  employee_contribution NUMERIC(12,2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  card_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hr_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_benefits_select" ON public.hr_benefits FOR SELECT TO authenticated
  USING (account_id = public.get_my_account_id());
CREATE POLICY "hr_benefits_insert" ON public.hr_benefits FOR INSERT TO authenticated
  WITH CHECK (account_id = public.get_my_account_id());
CREATE POLICY "hr_benefits_update" ON public.hr_benefits FOR UPDATE TO authenticated
  USING (account_id = public.get_my_account_id());
CREATE POLICY "hr_benefits_delete" ON public.hr_benefits FOR DELETE TO authenticated
  USING (account_id = public.get_my_account_id());

CREATE TRIGGER update_hr_benefits_updated_at
  BEFORE UPDATE ON public.hr_benefits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_hr_benefits_collaborator ON public.hr_benefits(collaborator_id);

-- =============================================
-- STORAGE BUCKET FOR HR DOCUMENTS
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('hr-documents', 'hr-documents', false);

CREATE POLICY "hr_docs_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'hr-documents');

CREATE POLICY "hr_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hr-documents');

CREATE POLICY "hr_docs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'hr-documents');

CREATE POLICY "hr_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'hr-documents');
