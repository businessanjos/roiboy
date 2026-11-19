ALTER TABLE public.tv_screens ADD COLUMN IF NOT EXISTS previous_url text, ADD COLUMN IF NOT EXISTS image_until timestamptz;
CREATE TABLE public.tv_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL UNIQUE,
  url text NOT NULL,
  name text NOT NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.tv_media TO authenticated;
GRANT ALL ON public.tv_media TO service_role;
ALTER TABLE public.tv_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tv_media managers read" ON public.tv_media FOR SELECT TO authenticated USING (public.tv_can_manage(auth.uid()));
CREATE POLICY "tv_media managers insert" ON public.tv_media FOR INSERT TO authenticated WITH CHECK (public.tv_can_manage(auth.uid()));
CREATE POLICY "tv_media managers delete" ON public.tv_media FOR DELETE TO authenticated USING (public.tv_can_manage(auth.uid()));
CREATE POLICY "tv-media insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tv-media' AND public.tv_can_manage(auth.uid()));
CREATE POLICY "tv-media delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'tv-media' AND public.tv_can_manage(auth.uid()));