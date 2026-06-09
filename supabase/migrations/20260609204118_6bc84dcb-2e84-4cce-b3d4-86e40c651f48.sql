
-- PR1: gestão da vaga
ALTER TABLE public.hr_jobs
  ADD COLUMN IF NOT EXISTS hiring_manager_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recruiter_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_fill_date date,
  ADD COLUMN IF NOT EXISTS opening_reason text,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz NOT NULL DEFAULT now();

-- PR2: etapas customizadas por vaga
CREATE TABLE IF NOT EXISTS public.hr_job_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.hr_jobs(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index int NOT NULL DEFAULT 0,
  sla_days int,
  owner_role text,
  evaluation_criteria text[] NOT NULL DEFAULT '{}',
  ai_focus text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_job_stages TO authenticated;
GRANT ALL ON public.hr_job_stages TO service_role;
ALTER TABLE public.hr_job_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stages select by account" ON public.hr_job_stages FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "stages insert by account" ON public.hr_job_stages FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "stages update by account" ON public.hr_job_stages FOR UPDATE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "stages delete by account" ON public.hr_job_stages FOR DELETE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS hr_job_stages_job_idx ON public.hr_job_stages(job_id, order_index);

CREATE TRIGGER hr_job_stages_updated_at BEFORE UPDATE ON public.hr_job_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PR2: match IA por candidato
ALTER TABLE public.hr_job_applications
  ADD COLUMN IF NOT EXISTS current_stage_id uuid REFERENCES public.hr_job_stages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_match_score int,
  ADD COLUMN IF NOT EXISTS ai_match_report jsonb,
  ADD COLUMN IF NOT EXISTS ai_match_analyzed_at timestamptz,
  ADD COLUMN IF NOT EXISTS stage_entered_at timestamptz DEFAULT now();
