ALTER TABLE public.omie_settings ADD COLUMN IF NOT EXISTS default_retem_iss text NOT NULL DEFAULT 'N';
ALTER TABLE public.omie_settings ADD COLUMN IF NOT EXISTS default_city text;