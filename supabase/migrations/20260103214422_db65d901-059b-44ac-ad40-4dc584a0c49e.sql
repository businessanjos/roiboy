-- Add installments_detail column to store flexible payment details per installment
ALTER TABLE public.client_contracts 
ADD COLUMN IF NOT EXISTS installments_detail JSONB DEFAULT '[]'::jsonb;

-- Structure example:
-- [
--   {
--     "number": 1,
--     "amount": 1000,
--     "due_date": "2025-02-15",
--     "payments": [
--       { "method": "pix", "amount": 700 },
--       { "method": "cheque", "amount": 300 }
--     ]
--   },
--   {
--     "number": 2,
--     "amount": 1000,
--     "due_date": "2025-03-15",
--     "payments": [
--       { "method": "boleto", "amount": 1000 }
--     ]
--   }
-- ]

COMMENT ON COLUMN public.client_contracts.installments_detail IS 'Detailed breakdown of each installment with multiple payment methods per installment';