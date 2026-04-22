ALTER TABLE public.sales_call_analyses
ADD COLUMN IF NOT EXISTS product_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sales_call_analyses_product_id_fkey'
  ) THEN
    ALTER TABLE public.sales_call_analyses
    ADD CONSTRAINT sales_call_analyses_product_id_fkey
    FOREIGN KEY (product_id)
    REFERENCES public.products(id)
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_call_analyses_product_id
ON public.sales_call_analyses (product_id);