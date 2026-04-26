ALTER TABLE public.deal_operation_briefings
  ADD COLUMN IF NOT EXISTS pais text,
  ADD COLUMN IF NOT EXISTS pais_codigo text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS estado_uf text,
  ADD COLUMN IF NOT EXISTS moeda_codigo text DEFAULT 'BRL';

COMMENT ON COLUMN public.deal_operation_briefings.pais_codigo IS 'ISO 3166-1 alpha-2 (BR, US, PT, ...)';
COMMENT ON COLUMN public.deal_operation_briefings.estado_uf IS 'UF quando Brasil (SP, RS, ...)';
COMMENT ON COLUMN public.deal_operation_briefings.moeda_codigo IS 'ISO 4217 (BRL, USD, EUR, ...). Valores monetarios sao salvos na moeda original.';