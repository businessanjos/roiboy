ALTER TABLE public.sector_settings
  ADD COLUMN IF NOT EXISTS royzapp_host text,
  ADD COLUMN IF NOT EXISTS royzapp_admin_token_secret_name text;

COMMENT ON COLUMN public.sector_settings.royzapp_host IS 'Optional override: UAZAPI host for this sector (e.g. https://cs-roy-eternum.uazapi.com). When NULL, falls back to global UAZAPI_URL secret.';
COMMENT ON COLUMN public.sector_settings.royzapp_admin_token_secret_name IS 'Optional override: name of the Supabase secret holding the admin token for this sector server (e.g. UAZAPI_OPERACOES_ADMIN_TOKEN). When NULL, falls back to global UAZAPI_ADMIN_TOKEN.';