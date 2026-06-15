-- hr_jobs: anon precisa ler vagas ativas (política "Anyone can view active jobs" já existe)
GRANT SELECT ON public.hr_jobs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_jobs TO authenticated;
GRANT ALL ON public.hr_jobs TO service_role;

-- hr_job_applications: anon precisa inserir candidaturas via formulário público
GRANT INSERT ON public.hr_job_applications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_job_applications TO authenticated;
GRANT ALL ON public.hr_job_applications TO service_role;