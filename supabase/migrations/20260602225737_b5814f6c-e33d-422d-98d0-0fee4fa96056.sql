ALTER TABLE public.marketing_project_milestones
  ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'planning',
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS owner TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS progress INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_mpm_phase ON public.marketing_project_milestones(project_id, phase);