ALTER TABLE public.digital_contracts
  ADD COLUMN IF NOT EXISTS down_payment_value numeric,
  ADD COLUMN IF NOT EXISTS down_payment_date date;