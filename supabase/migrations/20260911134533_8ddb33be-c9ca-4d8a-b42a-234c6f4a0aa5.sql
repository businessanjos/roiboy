ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS temperature text,
  ADD COLUMN IF NOT EXISTS temperature_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS temperature_manual_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_contact_at timestamptz;

ALTER TABLE public.threecplus_call_logs
  ADD COLUMN IF NOT EXISTS followup_task_id uuid REFERENCES public.internal_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_threecplus_call_logs_followup_task
  ON public.threecplus_call_logs (followup_task_id) WHERE followup_task_id IS NOT NULL;

ALTER TABLE public.account_settings
  ADD COLUMN IF NOT EXISTS calls_auto_tasks boolean NOT NULL DEFAULT true;