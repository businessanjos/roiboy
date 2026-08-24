DROP INDEX IF EXISTS public.threecplus_call_logs_account_call_id_key;
ALTER TABLE public.threecplus_call_logs
  ADD CONSTRAINT threecplus_call_logs_account_call_id_key UNIQUE (account_id, call_id);