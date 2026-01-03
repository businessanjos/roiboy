-- Add credit card specific fields to bank_accounts
ALTER TABLE public.bank_accounts
ADD COLUMN IF NOT EXISTS card_brand text,
ADD COLUMN IF NOT EXISTS card_last_digits text,
ADD COLUMN IF NOT EXISTS closing_day integer,
ADD COLUMN IF NOT EXISTS due_day integer;

-- Add comments for documentation
COMMENT ON COLUMN public.bank_accounts.card_brand IS 'Bandeira do cartão (Visa, Mastercard, Elo, etc.)';
COMMENT ON COLUMN public.bank_accounts.card_last_digits IS 'Últimos 4 dígitos do cartão';
COMMENT ON COLUMN public.bank_accounts.closing_day IS 'Dia do fechamento da fatura (1-31)';
COMMENT ON COLUMN public.bank_accounts.due_day IS 'Dia do vencimento da fatura (1-31)';

-- Add check constraints
ALTER TABLE public.bank_accounts
ADD CONSTRAINT bank_accounts_closing_day_check CHECK (closing_day IS NULL OR (closing_day >= 1 AND closing_day <= 31)),
ADD CONSTRAINT bank_accounts_due_day_check CHECK (due_day IS NULL OR (due_day >= 1 AND due_day <= 31)),
ADD CONSTRAINT bank_accounts_card_last_digits_check CHECK (card_last_digits IS NULL OR length(card_last_digits) = 4);