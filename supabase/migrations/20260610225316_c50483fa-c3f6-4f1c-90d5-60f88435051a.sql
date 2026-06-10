ALTER TABLE public.hr_jobs
  ADD COLUMN IF NOT EXISTS screening_questions JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.hr_job_applications
  ADD COLUMN IF NOT EXISTS screening_answers JSONB NOT NULL DEFAULT '{}'::jsonb;