DROP INDEX IF EXISTS public.uq_financial_entries_account_omie;
ALTER TABLE public.financial_entries
  ADD CONSTRAINT financial_entries_account_omie_uniq UNIQUE (account_id, omie_id);