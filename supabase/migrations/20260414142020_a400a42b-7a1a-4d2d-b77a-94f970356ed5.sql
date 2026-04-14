ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS mql_criteria jsonb DEFAULT NULL;