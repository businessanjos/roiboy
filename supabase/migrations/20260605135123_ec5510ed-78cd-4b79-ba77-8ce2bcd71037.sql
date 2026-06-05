GRANT SELECT, UPDATE ON public.hr_job_offers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_job_offers TO authenticated;
GRANT ALL ON public.hr_job_offers TO service_role;