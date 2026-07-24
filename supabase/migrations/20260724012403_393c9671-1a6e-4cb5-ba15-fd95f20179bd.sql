
CREATE TABLE public.hr_job_benchmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL UNIQUE REFERENCES public.hr_jobs(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  benchmark JSONB NOT NULL,
  input_signature TEXT,
  generated_by UUID REFERENCES public.users(id),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_job_benchmarks TO authenticated;
GRANT ALL ON public.hr_job_benchmarks TO service_role;

ALTER TABLE public.hr_job_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read benchmarks in their account"
  ON public.hr_job_benchmarks FOR SELECT
  USING (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()));

CREATE POLICY "Users insert benchmarks in their account"
  ON public.hr_job_benchmarks FOR INSERT
  WITH CHECK (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()));

CREATE POLICY "Users update benchmarks in their account"
  ON public.hr_job_benchmarks FOR UPDATE
  USING (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()));

CREATE POLICY "Users delete benchmarks in their account"
  ON public.hr_job_benchmarks FOR DELETE
  USING (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()));

CREATE TRIGGER hr_job_benchmarks_updated_at
  BEFORE UPDATE ON public.hr_job_benchmarks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
