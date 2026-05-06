ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS timezone text;

COMMENT ON COLUMN public.clients.timezone IS 'IANA timezone string (e.g., America/Sao_Paulo). NULL = auto-detect from country/phone.';