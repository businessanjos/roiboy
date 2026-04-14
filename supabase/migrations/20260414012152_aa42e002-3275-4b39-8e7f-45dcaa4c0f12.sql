-- Enum for job status
CREATE TYPE public.hr_job_status AS ENUM ('draft', 'active', 'on_hold', 'closed');

-- Enum for candidate pipeline stage
CREATE TYPE public.hr_candidate_stage AS ENUM ('applied', 'screening', 'interview', 'technical_test', 'offer', 'hired', 'rejected');

-- Enum for AI analysis status
CREATE TYPE public.hr_ai_analysis_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Jobs table
CREATE TABLE public.hr_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.users(id),
  title TEXT NOT NULL,
  description TEXT,
  requirements TEXT,
  department TEXT,
  position TEXT,
  unit TEXT,
  work_model TEXT DEFAULT 'onsite',
  contract_type TEXT DEFAULT 'clt',
  seniority TEXT,
  openings_count INTEGER DEFAULT 1,
  description_tone TEXT,
  description_context TEXT,
  required_skills TEXT[] DEFAULT '{}',
  desired_skills TEXT[] DEFAULT '{}',
  experience_years INTEGER,
  education_level TEXT,
  languages JSONB DEFAULT '[]',
  salary_type TEXT DEFAULT 'not_disclosed',
  salary_min NUMERIC,
  salary_max NUMERIC,
  benefits TEXT[] DEFAULT '{}',
  application_deadline DATE,
  expected_start_date DATE,
  urgency TEXT DEFAULT 'medium',
  require_cover_letter BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  status public.hr_job_status NOT NULL DEFAULT 'draft',
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Job applications table
CREATE TABLE public.hr_job_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.hr_jobs(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  candidate_name TEXT NOT NULL,
  candidate_email TEXT NOT NULL,
  candidate_phone TEXT,
  candidate_city TEXT,
  candidate_state TEXT,
  candidate_birth_date DATE,
  candidate_gender TEXT,
  candidate_race TEXT,
  candidate_sexual_orientation TEXT,
  candidate_pcd BOOLEAN DEFAULT false,
  candidate_pcd_type TEXT,
  desired_position TEXT,
  desired_seniority TEXT,
  resume_url TEXT,
  cover_letter TEXT,
  stage public.hr_candidate_stage NOT NULL DEFAULT 'applied',
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  ai_analysis_status public.hr_ai_analysis_status,
  ai_score NUMERIC,
  ai_report TEXT,
  profiler_result_code TEXT,
  profiler_result_detail JSONB,
  profiler_completed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_hr_jobs_account_id ON public.hr_jobs(account_id);
CREATE INDEX idx_hr_jobs_status ON public.hr_jobs(status);
CREATE INDEX idx_hr_job_applications_job_id ON public.hr_job_applications(job_id);
CREATE INDEX idx_hr_job_applications_account_id ON public.hr_job_applications(account_id);
CREATE INDEX idx_hr_job_applications_stage ON public.hr_job_applications(stage);

-- Enable RLS
ALTER TABLE public.hr_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_job_applications ENABLE ROW LEVEL SECURITY;

-- RLS policies for hr_jobs
CREATE POLICY "Users can view jobs from their account"
  ON public.hr_jobs FOR SELECT
  TO authenticated
  USING (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can create jobs in their account"
  ON public.hr_jobs FOR INSERT
  TO authenticated
  WITH CHECK (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can update jobs in their account"
  ON public.hr_jobs FOR UPDATE
  TO authenticated
  USING (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can delete jobs in their account"
  ON public.hr_jobs FOR DELETE
  TO authenticated
  USING (account_id = public.get_current_user_account_id());

-- RLS policies for hr_job_applications
CREATE POLICY "Users can view applications from their account"
  ON public.hr_job_applications FOR SELECT
  TO authenticated
  USING (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can create applications in their account"
  ON public.hr_job_applications FOR INSERT
  TO authenticated
  WITH CHECK (account_id = public.get_current_user_account_id());

CREATE POLICY "Anyone can create applications (public form)"
  ON public.hr_job_applications FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Users can update applications in their account"
  ON public.hr_job_applications FOR UPDATE
  TO authenticated
  USING (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can delete applications in their account"
  ON public.hr_job_applications FOR DELETE
  TO authenticated
  USING (account_id = public.get_current_user_account_id());

-- Public read access for jobs (for public application form)
CREATE POLICY "Anyone can view active jobs"
  ON public.hr_jobs FOR SELECT
  TO anon
  USING (status = 'active');

-- Triggers for updated_at
CREATE TRIGGER update_hr_jobs_updated_at
  BEFORE UPDATE ON public.hr_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hr_job_applications_updated_at
  BEFORE UPDATE ON public.hr_job_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();