ALTER TABLE public.threecplus_call_logs
  ADD COLUMN IF NOT EXISTS engine text NOT NULL DEFAULT '3cplus',
  ADD COLUMN IF NOT EXISTS external_ref text,
  ADD COLUMN IF NOT EXISTS end_reason text;

CREATE INDEX IF NOT EXISTS idx_threecplus_call_logs_engine
  ON public.threecplus_call_logs (account_id, engine, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_threecplus_call_logs_external_ref
  ON public.threecplus_call_logs (external_ref) WHERE external_ref IS NOT NULL;