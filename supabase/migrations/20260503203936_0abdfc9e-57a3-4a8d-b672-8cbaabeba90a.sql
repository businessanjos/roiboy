
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$
  SELECT public.unaccent('public.unaccent', $1)
$$;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS full_name_normalized text
  GENERATED ALWAYS AS (lower(public.immutable_unaccent(full_name))) STORED;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS company_name_normalized text
  GENERATED ALWAYS AS (lower(public.immutable_unaccent(company_name))) STORED;

CREATE INDEX IF NOT EXISTS idx_clients_full_name_normalized_trgm
  ON public.clients USING gin (full_name_normalized gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_clients_company_name_normalized_trgm
  ON public.clients USING gin (company_name_normalized gin_trgm_ops);
