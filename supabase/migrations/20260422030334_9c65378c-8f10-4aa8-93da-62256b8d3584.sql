ALTER TABLE public.sales_call_analyses
  ADD COLUMN IF NOT EXISTS source_filename text,
  ADD COLUMN IF NOT EXISTS source_hash text,
  ADD COLUMN IF NOT EXISTS ai_score numeric,
  ADD COLUMN IF NOT EXISTS extracted_seller_name text,
  ADD COLUMN IF NOT EXISTS extracted_lead_name text,
  ADD COLUMN IF NOT EXISTS call_date date;

CREATE UNIQUE INDEX IF NOT EXISTS sales_call_analyses_account_source_hash_unique
  ON public.sales_call_analyses(account_id, source_hash)
  WHERE source_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS sales_call_analyses_call_date_idx
  ON public.sales_call_analyses(call_date);