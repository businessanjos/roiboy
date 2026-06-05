
CREATE POLICY "Account members read admission docs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'admission-docs'
  AND (storage.foldername(name))[1] = public.get_user_account_id()::text
);

CREATE POLICY "Account members upload admission docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'admission-docs'
  AND (storage.foldername(name))[1] = public.get_user_account_id()::text
);

CREATE POLICY "Account members update admission docs"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'admission-docs'
  AND (storage.foldername(name))[1] = public.get_user_account_id()::text
);

CREATE POLICY "Account members delete admission docs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'admission-docs'
  AND (storage.foldername(name))[1] = public.get_user_account_id()::text
);
