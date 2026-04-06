
ALTER TABLE public.products 
ADD COLUMN cash_price numeric DEFAULT 0,
ADD COLUMN installment_price numeric DEFAULT 0,
ADD COLUMN payment_methods jsonb DEFAULT '[]'::jsonb;
