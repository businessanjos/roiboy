ALTER TABLE public.tv_settings
  ADD COLUMN IF NOT EXISTS rest_url text DEFAULT 'https://iamroy.app/tv/descanso',
  ADD COLUMN IF NOT EXISTS rest_windows jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rest_logo_url text,
  ADD COLUMN IF NOT EXISTS rest_photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rest_messages jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE public.tv_settings SET rest_url = 'https://iamroy.app/tv/descanso' WHERE rest_url IS NULL;
ALTER TABLE public.tv_screens ADD COLUMN IF NOT EXISTS rest_enabled boolean;

CREATE OR REPLACE FUNCTION public.tv_rest_content()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE
    (SELECT jsonb_build_object('logo_url', rest_logo_url, 'photos', rest_photos, 'messages', rest_messages)
     FROM public.tv_settings WHERE id = 1) END
$$;
REVOKE ALL ON FUNCTION public.tv_rest_content() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tv_rest_content() TO authenticated;