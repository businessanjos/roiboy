ALTER TABLE public.hr_job_stages
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS what_to_do text,
  ADD COLUMN IF NOT EXISTS test_or_material text;