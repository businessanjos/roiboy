ALTER TABLE public.hr_job_offers
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_name text;

CREATE INDEX IF NOT EXISTS hr_job_offers_is_template_idx
  ON public.hr_job_offers(account_id, is_template);