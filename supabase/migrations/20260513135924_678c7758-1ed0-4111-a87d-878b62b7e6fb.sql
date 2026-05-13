
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS openfinance_connection_id text,
  ADD COLUMN IF NOT EXISTS openfinance_account_id text,
  ADD COLUMN IF NOT EXISTS openfinance_institution text,
  ADD COLUMN IF NOT EXISTS last_balance_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_transactions_sync_at timestamptz;

ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS openfinance_transaction_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_entries_openfinance_tx
  ON public.financial_entries(bank_account_id, openfinance_transaction_id)
  WHERE openfinance_transaction_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.openfinance_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  sync_type text NOT NULL, -- 'balance' | 'transactions'
  status text NOT NULL DEFAULT 'running', -- 'running' | 'success' | 'error'
  transactions_imported integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_openfinance_sync_logs_account ON public.openfinance_sync_logs(account_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_openfinance_sync_logs_bank_account ON public.openfinance_sync_logs(bank_account_id, started_at DESC);

ALTER TABLE public.openfinance_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their account's sync logs"
  ON public.openfinance_sync_logs FOR SELECT
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Service role manages sync logs"
  ON public.openfinance_sync_logs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
