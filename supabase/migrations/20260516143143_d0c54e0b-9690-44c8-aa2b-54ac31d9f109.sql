ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS openfinance_provider text;
COMMENT ON COLUMN public.bank_accounts.openfinance_provider IS 'pluggy | banco_mcp — define qual API usar para sync de saldo/extrato';
UPDATE public.bank_accounts SET openfinance_provider = 'banco_mcp' WHERE openfinance_account_id IS NOT NULL AND openfinance_provider IS NULL;

ALTER TABLE public.openfinance_sync_logs ADD COLUMN IF NOT EXISTS provider text DEFAULT 'pluggy';