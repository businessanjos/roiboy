ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS consultant_seniority text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.products.consultant_seniority IS 'Senioridades de consultor CS que atendem este produto: junior, pleno, senior, lead';