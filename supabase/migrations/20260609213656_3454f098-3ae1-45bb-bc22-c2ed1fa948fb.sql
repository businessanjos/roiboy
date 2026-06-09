
ALTER TABLE public.hr_service_providers
  ADD COLUMN IF NOT EXISTS is_recruitment_partner boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recruitment_commission_pct numeric,
  ADD COLUMN IF NOT EXISTS recruitment_notes text;

ALTER TABLE public.hr_jobs
  ADD COLUMN IF NOT EXISTS recruiter_provider_id uuid REFERENCES public.hr_service_providers(id) ON DELETE SET NULL;

ALTER TABLE public.hr_job_stages
  ADD COLUMN IF NOT EXISTS owner_provider_id uuid REFERENCES public.hr_service_providers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_hr_jobs_recruiter_provider_id ON public.hr_jobs(recruiter_provider_id);
CREATE INDEX IF NOT EXISTS idx_hr_job_stages_owner_provider_id ON public.hr_job_stages(owner_provider_id);
CREATE INDEX IF NOT EXISTS idx_hr_service_providers_recruitment_partner ON public.hr_service_providers(account_id) WHERE is_recruitment_partner = true;
