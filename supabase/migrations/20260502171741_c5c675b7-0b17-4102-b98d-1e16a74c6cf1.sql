
-- Add category column to payment_methods (a_vista | parcelado)
ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'a_vista';

ALTER TABLE public.payment_methods
  DROP CONSTRAINT IF EXISTS payment_methods_category_check;

ALTER TABLE public.payment_methods
  ADD CONSTRAINT payment_methods_category_check
  CHECK (category IN ('a_vista','parcelado'));

-- Backfill from has_parcelas
UPDATE public.payment_methods
   SET category = CASE WHEN has_parcelas THEN 'parcelado' ELSE 'a_vista' END
 WHERE category IS NULL OR category = 'a_vista';
