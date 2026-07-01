ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS education TEXT,
  ADD COLUMN IF NOT EXISTS education_specialty TEXT;

CREATE INDEX IF NOT EXISTS idx_clients_education ON public.clients (account_id, education) WHERE education IS NOT NULL;