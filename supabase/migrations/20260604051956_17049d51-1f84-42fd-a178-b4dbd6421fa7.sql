
CREATE POLICY "Account members read event-design"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'event-design'
    AND (storage.foldername(name))[1] = public.get_user_account_id()::text
  );

CREATE POLICY "Account members upload event-design"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'event-design'
    AND (storage.foldername(name))[1] = public.get_user_account_id()::text
  );

CREATE POLICY "Account members update event-design"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'event-design'
    AND (storage.foldername(name))[1] = public.get_user_account_id()::text
  );

CREATE POLICY "Account members delete event-design"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'event-design'
    AND (storage.foldername(name))[1] = public.get_user_account_id()::text
  );
