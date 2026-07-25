CREATE TABLE public.hr_job_benchmark_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.hr_jobs(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  triggered_by uuid REFERENCES public.users(id),
  trigger_source text NOT NULL DEFAULT 'manual',
  offered_salary_min numeric,
  offered_salary_max numeric,
  market_p25 numeric,
  market_p50 numeric,
  market_p75 numeric,
  offered_benefits text[] NOT NULL DEFAULT '{}',
  catalog_benefits text[] NOT NULL DEFAULT '{}',
  catalog_benefits_matched integer NOT NULL DEFAULT 0,
  typical_benefits text[] NOT NULL DEFAULT '{}',
  covered_benefits text[] NOT NULL DEFAULT '{}',
  missing_benefits text[] NOT NULL DEFAULT '{}',
  extra_benefits text[] NOT NULL DEFAULT '{}',
  work_model text,
  city text,
  state text,
  score_total integer,
  score_tier text,
  score_salary integer,
  score_benefits integer,
  score_location integer,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.hr_job_benchmark_runs TO authenticated;
GRANT ALL ON public.hr_job_benchmark_runs TO service_role;

ALTER TABLE public.hr_job_benchmark_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read benchmark runs in their account"
ON public.hr_job_benchmark_runs FOR SELECT TO authenticated
USING (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()));

CREATE POLICY "Users insert benchmark runs in their account"
ON public.hr_job_benchmark_runs FOR INSERT TO authenticated
WITH CHECK (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()));

CREATE INDEX hr_job_benchmark_runs_job_idx ON public.hr_job_benchmark_runs (job_id, created_at DESC);