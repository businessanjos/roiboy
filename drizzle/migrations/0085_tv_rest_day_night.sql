ALTER TABLE public.tv_settings
  ADD COLUMN IF NOT EXISTS rest_day_image text,
  ADD COLUMN IF NOT EXISTS rest_night_image text,
  ADD COLUMN IF NOT EXISTS rest_day_from text NOT NULL DEFAULT '06:00',
  ADD COLUMN IF NOT EXISTS rest_night_from text NOT NULL DEFAULT '18:00';
ALTER TABLE public.tv_screens ADD COLUMN IF NOT EXISTS rest_prev_url text;
CREATE OR REPLACE FUNCTION public.tv_rest_content()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT jsonb_build_object('logo_url', rest_logo_url, 'photos', rest_photos, 'messages', rest_messages,
       'day_image', rest_day_image, 'night_image', rest_night_image, 'day_from', rest_day_from, 'night_from', rest_night_from)
     FROM public.tv_settings WHERE id = 1), '{}'::jsonb);
$$;
REVOKE ALL ON FUNCTION public.tv_rest_content() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tv_rest_content() TO authenticated;