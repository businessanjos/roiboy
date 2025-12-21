
-- Add payment method configured field to accounts
ALTER TABLE public.accounts 
ADD COLUMN payment_method_configured boolean NOT NULL DEFAULT false;

-- Add comment explaining the field
COMMENT ON COLUMN public.accounts.payment_method_configured IS 'True when user has registered a credit card or made a PIX payment';
