ALTER TABLE public.user_royzapp_views
  ADD COLUMN IF NOT EXISTS zapp_sectors text[] NULL;

COMMENT ON COLUMN public.user_royzapp_views.zapp_sectors IS
  'Setores do RoyZapp (WhatsApp) liberados para o usuario. NULL = herda user_sector_access.';