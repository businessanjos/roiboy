-- Add negotiation fields to client_contracts
ALTER TABLE public.client_contracts
ADD COLUMN negotiation_type text DEFAULT 'standard',
ADD COLUMN negotiation_description text,
ADD COLUMN payment_method text,
ADD COLUMN installments_count integer DEFAULT 1,
ADD COLUMN first_due_date date,
ADD COLUMN receivables_generated boolean DEFAULT false,
ADD COLUMN receivables_generated_at timestamp with time zone;

-- Add comment
COMMENT ON COLUMN public.client_contracts.negotiation_type IS 'standard or custom';
COMMENT ON COLUMN public.client_contracts.negotiation_description IS 'Description for custom negotiations';
COMMENT ON COLUMN public.client_contracts.payment_method IS 'pix, boleto, cartao, cheque';
COMMENT ON COLUMN public.client_contracts.installments_count IS 'Number of installments';
COMMENT ON COLUMN public.client_contracts.first_due_date IS 'First installment due date';
COMMENT ON COLUMN public.client_contracts.receivables_generated IS 'Whether receivables were already generated';