DROP INDEX IF EXISTS idx_threecplus_call_logs_call_id;
CREATE UNIQUE INDEX idx_threecplus_call_logs_call_id_unique ON public.threecplus_call_logs (call_id);
