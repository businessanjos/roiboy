CREATE POLICY "tv-rest read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'tv-rest');
CREATE POLICY "tv-rest insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tv-rest' AND public.tv_can_manage(auth.uid()));
CREATE POLICY "tv-rest update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'tv-rest' AND public.tv_can_manage(auth.uid()));
CREATE POLICY "tv-rest delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'tv-rest' AND public.tv_can_manage(auth.uid()));