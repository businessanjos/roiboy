ALTER TABLE public.hr_service_providers
ADD COLUMN IF NOT EXISTS provider_kind text NOT NULL DEFAULT 'on_demand';

COMMENT ON COLUMN public.hr_service_providers.provider_kind IS 'director = PJ diretor/cargo de confiança | on_demand = prestador sob demanda';