CREATE TABLE public.hr_company_benefits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'outros',
  provider text,
  description text,
  monthly_value numeric(12,2) DEFAULT 0,
  employee_contribution numeric(12,2) DEFAULT 0,
  contract_types text[] NOT NULL DEFAULT ARRAY['clt']::text[],
  is_highlight boolean NOT NULL DEFAULT false,
  include_in_jobs_by_default boolean NOT NULL DEFAULT true,
  use_in_benchmark boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_company_benefits TO authenticated;
GRANT ALL ON public.hr_company_benefits TO service_role;

ALTER TABLE public.hr_company_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_company_benefits_select" ON public.hr_company_benefits
  FOR SELECT TO authenticated USING (account_id = public.get_my_account_id());
CREATE POLICY "hr_company_benefits_insert" ON public.hr_company_benefits
  FOR INSERT TO authenticated WITH CHECK (account_id = public.get_my_account_id());
CREATE POLICY "hr_company_benefits_update" ON public.hr_company_benefits
  FOR UPDATE TO authenticated USING (account_id = public.get_my_account_id());
CREATE POLICY "hr_company_benefits_delete" ON public.hr_company_benefits
  FOR DELETE TO authenticated USING (account_id = public.get_my_account_id());

CREATE INDEX idx_hr_company_benefits_account ON public.hr_company_benefits(account_id, is_active);

CREATE TRIGGER update_hr_company_benefits_updated_at
  BEFORE UPDATE ON public.hr_company_benefits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();