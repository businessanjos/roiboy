
CREATE POLICY "Account members can read offboarding docs storage"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'offboarding-docs'
  AND (storage.foldername(name))[1] IN (
    SELECT account_id::text FROM public.users WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Account members can upload offboarding docs storage"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'offboarding-docs'
  AND (storage.foldername(name))[1] IN (
    SELECT account_id::text FROM public.users WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Account members can delete offboarding docs storage"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'offboarding-docs'
  AND (storage.foldername(name))[1] IN (
    SELECT account_id::text FROM public.users WHERE auth_user_id = auth.uid()
  )
);
